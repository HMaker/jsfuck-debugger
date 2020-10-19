#!/usr/bin/env nodejs
const esprima = require('esprima');


class JSFuckSyntaxError extends Error {
    constructor(message, start_pos, end_pos) {
        super(message);
        this.name = 'JSFuckSyntaxError';
        this.start_pos = start_pos;
        this.end_pos = end_pos;
    }
}

function evaltree_shrink_branch(ast_node, type) {
    if(ast_node.type !== type) return ast_node;
    switch(type) {
        case 'UnaryExpression':
            return evaltree_shrink_branch(ast_node.argument, type);
        case 'ArrayExpression':
            if(ast_node.elements.length == 1) return evaltree_shrink_branch(ast_node.elements[0], type);
            return ast_node;
        default:
            throw new JSFuckSyntaxError(
                `unexpected node of type '${type}' while shrinking branch`,
                ast_node.range[0],
                ast_node.range[1]
            );
    }
}

function evaltree_parse_node(ast_node, parent) {
    let node = {
        'start': ast_node.range[0],
        'end': ast_node.range[1],
        'parent': parent,
        'level': parent ? parent.level + 1 : 0,
        'children': []
    }
    switch(ast_node.type) {
        case 'Program':
            for(const ast_child of ast_node.body) node.children.push(evaltree_parse_node(ast_child, node));
            break;
        case 'ExpressionStatement':
            node = evaltree_parse_node(ast_node.expression, parent);
            break;
        case 'BinaryExpression':
            node.children.push(evaltree_parse_node(ast_node.left, node));
            node.children.push(evaltree_parse_node(ast_node.right, node));
            break;
        case 'UnaryExpression':
            node.children.push(evaltree_parse_node(
                evaltree_shrink_branch(ast_node.argument, ast_node.type),
                node
            ));
            break;
        case 'ArrayExpression':
            for(const ast_child of ast_node.elements) node.children.push(evaltree_parse_node(ast_child, node));
            break;
        case 'ObjectExpression':
            for(const ast_child of ast_node.properties) node.children.push(evaltree_parse_node(ast_child, node));
            break;
        case 'Property':
            node.children.push(evaltree_parse_node(ast_child.key, node));
            node.children.push(evaltree_parse_node(ast_child.value, node));
            break;
        case 'MemberExpression':
            node.children.push(evaltree_parse_node(ast_node.object, node));
            node.children.push(evaltree_parse_node(ast_node.property, node));
            break;
        case 'CallExpression':
            node.children.push(evaltree_parse_node(ast_node.callee, node));
            for(const ast_child of ast_node.arguments) node.children.push(evaltree_parse_node(ast_child, node));
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

function evaltree_get_deeper_node(node) {
    let deeper = node;
    for(const child of node.children) {
        let next_deeper = evaltree_get_deeper_node(child);
        if(next_deeper.level > deeper.level) {
            deeper = next_deeper;
        }
    }
    return deeper;
}

/** Yields all nodes that have children, starting from leaf nodes */
function* evaltree_iter_eval_branches(node, call_parent=true, current_child=null) {
    const branches = [];
    if(current_child) branches.push(current_child);
    for(const child of node.children) {
        if(child !== current_child && child.children.length > 0) {
            for(const child_branches of evaltree_iter_eval_branches(child, false)) {
                yield [...branches, ...child_branches];
            }
            branches.push(child);
        }
    }
    yield [node];
    if(call_parent && node.parent) yield* evaltree_iter_eval_branches(node.parent, true, node);
}

function evaltree_parse(jsfuck) {
    return evaltree_parse_node(esprima.parseScript(jsfuck, {range: true}), null);
}


class StopEvaluation extends Error {
    constructor() {
        super();
        this.name = 'StopEvaluation';
    }
}

class JSFuckEvaluator {

    constructor(jsfuck) {
        this._jsfuck = jsfuck;
        this._eval_start_node = evaltree_get_deeper_node(evaltree_parse(jsfuck))
        this.restart();
    }

    restart() {
        this._step = 1;
        this._eval_branches = evaltree_iter_eval_branches(this._eval_start_node);
    }

    get step() {
        return this._step;
    }

    evaluate(steps=1) {
        let iter = this._eval_branches.next();
        if(iter.done) throw new StopEvaluation();
        let i = 1, next_nodes = iter.value;
        this._step++;
        while(!iter.done && i < steps) {
            next_nodes = iter.value;
            iter = this._eval_branches.next();
            i++;
            this._step++;
        }
        let evaluation = '', jsfuck_index = 0;
        next_nodes.sort((node_a, node_b) => node_a.end - node_b.start);
        for(const node of next_nodes) {
            evaluation += (
                this._jsfuck.substring(jsfuck_index, node.start) + 
                this._eval_to_str(new Function('return ' + this._jsfuck.substring(node.start, node.end))())
            );
            jsfuck_index = node.end;
        }
        evaluation += this._jsfuck.substring(jsfuck_index, this._jsfuck.length);
        return evaluation;
    }

    _eval_to_str(object) {
        switch(typeof(object)) {
            case 'function':
                return `function ${object.name}(){}`;
            case 'number':
            case 'symbol':
                return object.toString();
            default:
                return JSON.stringify(object);
        }
    }
}


const CONSOLE_HEADER    = 'JSFuck Debugger by Heraldo Lucena <https://www.github.com/HMaker/>';
const PRINT_USAGE       = 'p, print                Print the last evaluation'
const CONTINUE_USAGE    = 'c, continue <steps>     Resume evaluation, <steps> tells the number of evaluations, it defaults to 1';
const SET_USAGE         = "s, set <name> <value>   Set the value of global variable named <name>, <value> must be a valid JavaScript expression. All code evaluations are done in the global scope";
const RESTART_USAGE     = 'r, restart              Restart evaluation';
const HELP_USAGE        = 'h, help                 Print this help message'
const USAGE             = [PRINT_USAGE, CONTINUE_USAGE, SET_USAGE, RESTART_USAGE, HELP_USAGE].join('\n');

/**
 * Start the debugger.
 * @param {String} jsfuck The JSFuck source.
 * @param {(message: String) => Promise<String>} prompt Async function that takes input from user.
 * 
*/
async function jsfuck_debug(jsfuck, prompt) {
    console.log(CONSOLE_HEADER + "\nType 'help' to see available commands");
    const evaluator = new JSFuckEvaluator(jsfuck);
    let evaluation = jsfuck;
    try {
        while(true) {
            let command = (await prompt('debug> ')).split(' ');
            switch(command[0]) {
                case 'c':
                case 'continue':
                    if(command.length > 1) {
                        const steps = parseInt(command[1]);
                        if(steps == NaN) {
                            console.log('Invalid parameter, a number is required');
                            break;
                        } else {
                            evaluation = evaluator.evaluate(steps);
                        }
                    } else {
                        evaluation = evaluator.evaluate();
                    }
                    console.log(`Step ${evaluator.step}:\n${evaluation}\n`);
                    break;
                case 's':
                case 'set':
                    if(command.length != 3) {
                        console.log('Invalid number of parameters for set command, type help for more info');
                    } else {
                        try {
                            global[command[1]] = new Function('return ' + command[2])();
                        } catch(error) {
                            console.error(error);
                        }
                    }
                    break;
                case 'p':
                case 'print':
                    console.log(`Step ${evaluator.step}:\n${evaluation}\n`);
                    break;
                case 'r':
                case 'restart':
                    evaluator.restart();
                    evaluation = jsfuck;
                    console.log('The evaluation has restarted');
                    break;
                case 'h':
                case 'help':
                    console.log(USAGE);
                    break;
                default:
                    console.log("Invalid command, type 'help' to see the available commands");
            }
        }
    } catch(error) {
        if(error instanceof StopEvaluation) {
            console.log('Evaluation finished.');
        } else {
            throw error;
        }
    }
}


async function main() {
    const readline = require('readline');
    const fs = require('fs');
    const input_reader = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const prompt = function(question) {
        return new Promise((resolve) => input_reader.question(question, resolve));
    }
    if(process.argv.length == 3) {
        await jsfuck_debug(fs.readFileSync(process.argv[2], {encoding: 'UTF-8'}), prompt);
    } else {
        console.log(`${CONSOLE_HEADER}\nUsage: nodejs ${process.argv[1]} <JSFuck script's pathname>`);
    }
}

/* If it is being run as script, start the debugger */
if(require.main === module) main();
