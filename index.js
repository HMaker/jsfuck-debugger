#!/usr/bin/env nodejs
'use strict';

const readline = require('readline');
const fs = require('fs');
const esprima = require('esprima');


const CONSOLE_HEADER = 'JSFuck Partial Evaluator by Heraldo Lucena <https://www.github.com/HMaker/>';


const input_reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
function input(question) {
    return new Promise((resolve) => input_reader.question(question, resolve));
}


class JSFuckSyntaxError extends Error {
    constructor(message, start_pos, end_pos) {
        super(message);
        this.name = 'JSFuckSyntaxError';
        this.start_pos = start_pos;
        this.end_pos = end_pos;
    }
}

function exptree_shrink_branch(ast_node, type) {
    if(ast_node.type !== type) return ast_node;
    switch(type) {
        case 'UnaryExpression':
            return exptree_shrink_branch(ast_node.argument, type);
        case 'ArrayExpression':
            if(ast_node.elements.length == 1) return exptree_shrink_branch(ast_node.elements[0], type);
            return ast_node;
        default:
            throw new JSFuckSyntaxError(
                `unexpected node of type '${type}' while shrinking branch`,
                ast_node.range[0],
                ast_node.range[1]
            );
    }
}

function exptree_parse_node(ast_node, parent) {
    let node = {
        'start': ast_node.range[0],
        'end': ast_node.range[1],
        'parent': parent,
        'level': parent ? parent.level + 1 : 0,
        'children': []
    }
    switch(ast_node.type) {
        case 'Program':
            for(const ast_child of ast_node.body) node.children.push(exptree_parse_node(ast_child, node));
            break;
        case 'ExpressionStatement':
            node = exptree_parse_node(ast_node.expression, parent);
            break;
        case 'BinaryExpression':
            node.children.push(exptree_parse_node(ast_node.left, node));
            node.children.push(exptree_parse_node(ast_node.right, node));
            break;
        case 'UnaryExpression':
            node.children.push(exptree_parse_node(
                exptree_shrink_branch(ast_node.argument, ast_node.type),
                node
            ));
            break;
        case 'ArrayExpression':
            for(const ast_child of ast_node.elements) node.children.push(exptree_parse_node(ast_child, node));
            break;
        case 'ObjectExpression':
            for(const ast_child of ast_node.properties) node.children.push(exptree_parse_node(ast_child, node));
            break;
        case 'Property':
            node.children.push(exptree_parse_node(ast_child.key, node));
            node.children.push(exptree_parse_node(ast_child.value, node));
            break;
        case 'MemberExpression':
            node.children.push(exptree_parse_node(ast_node.object, node));
            node.children.push(exptree_parse_node(ast_node.property, node));
            break;
        case 'CallExpression':
            node.children.push(exptree_parse_node(ast_node.callee, node));
            for(const ast_child of ast_node.arguments) node.children.push(exptree_parse_node(ast_child, node));
            break;
        case 'Literal':
            break;
        default:
            throw new JSFuckSyntaxError(
                `unexpected node of type '${ast_node.type}' at position (${ast_node.range[0]}, ${ast_node.range[1]})`,
                ast_node.range[0],
                ast_node.range[1]
            );
    }
    return node;
}

function exptree_get_deeper_node(node) {
    let deeper = node;
    for(const child of node.children) {
        let next_deeper = exptree_get_deeper_node(child);
        if(next_deeper.level > deeper.level) {
            deeper = next_deeper;
        }
    }
    return deeper;
}

/** Yields all nodes that have children, starting from a leaf node */
function* exptree_iter_eval_branches(node, call_parent=true, current_child=null) {
    const branches = [];
    if(current_child) branches.push(current_child);
    for(const child of node.children) {
        if(child !== current_child && child.children.length > 0) {
            for(const child_branches of exptree_iter_eval_branches(child, false)) {
                yield [...branches, ...child_branches];
            }
            branches.push(child);
        }
    }
    yield [node];
    if(call_parent && node.parent) yield* exptree_iter_eval_branches(node.parent, true, node);
}

function exptree_parse(jsfuck) {
    return exptree_parse_node(esprima.parseScript(jsfuck, {range: true}), null);
}


async function jsfuck_eval(jsfuck) {
    const eval_branches = exptree_iter_eval_branches(exptree_get_deeper_node(exptree_parse(jsfuck)));
    console.log('\n' + jsfuck + '\n');
    try {
        while(true) {
            let i = 1, iter = eval_branches.next();
            if(iter.done) break;
            let steps = parseInt(await input('Steps: '));
            if(steps == NaN) steps = 1;
            let next = iter;
            while(!iter.done && i < steps) {
                next = iter;
                iter = eval_branches.next();
                i++;
            }
            let evaluation = '', jsfuck_index = 0;
            for(const node of next.value) {
                evaluation += (
                    jsfuck.substring(jsfuck_index, node.start) + 
                    JSON.stringify(eval(jsfuck.substring(node.start, node.end)))
                );
                jsfuck_index = node.end;
            }
            evaluation += jsfuck.substring(jsfuck_index, jsfuck.length);
            console.log('\n' + evaluation + '\n');
        }
    } catch(error) {
        if(error !== undefined) {
            console.error(error);
        }
    } finally {
        process.exit(0);
    }
}


if(process.argv.length == 3) {
    console.log(CONSOLE_HEADER);
    jsfuck_eval(fs.readFileSync(process.argv[2], {encoding: 'UTF-8'}));
} else {
    console.log(`${CONSOLE_HEADER}\nUsage: nodejs ${process.argv[1]} <JSFuck script's pathname>`);
}
