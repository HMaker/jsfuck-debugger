#!/usr/bin/env nodejs
const readline = require('readline');
const fs = require('fs');
const esprima = require('esprima');


const CONSOLE_HEADER = 'JSFuck Partial Evaluator by Heraldo Lucena <https://www.github.com/HMaker/>';
const SUBEXP_START = '(', SUBEXP_END = ')';


const input_reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
function input(question) {
    return new Promise((resolve) => input_reader.question(question, resolve));
}

function exptree_parse_node(jsfuck, index, parent) {
    const node = {
        'start': index.value,
        'end': undefined,
        'parent': parent,
        'level': parent ? parent.level + 1 : 0,
        'children': []
    }
    while(index.value < jsfuck.length) {
        index.value++;
        let char = jsfuck[index.value];
        if(char == SUBEXP_START) {
            node.children.push(exptree_parse_node(jsfuck, index, node));
        }
        else if(char == SUBEXP_END) {
            node.end = index.value;
            break;
        }
    }
    return node;
}

function exptree_parse(jsfuck) {
    const root = exptree_parse_node(jsfuck, {value: 0}, null);
    root.end = jsfuck.length - 1;
    return root;
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

function* exptree_iter_bottom_branches(node, call_parent=true, excluded_child=null) {
    const branches = [];
    if(excluded_child) branches.push[excluded_child];
    for(const child of node.children) {
        if(child !== excluded_child) {
            for(const child_branches of exptree_iter_bottom_branches(child, false)) {
                yield [...branches, ...child_branches];
            }
            branches.push(child);
        }
    }
    yield [node];
    if(call_parent && node.parent) yield* exptree_iter_bottom_branches(node.parent, true, node);
}


async function jsfuck_eval(jsfuck) {
    const eval_branches = exptree_iter_bottom_branches(exptree_get_deeper_node(exptree_parse(jsfuck)));
    console.log('\n' + jsfuck + '\n');
    try {
        while(true) {
            let steps = parseInt(await input('Steps: '));
            if(steps == NaN) steps = 1;
            let i = 1, next = eval_branches.next();
            while(!next.done && i < steps) {
                next = eval_branches.next();
                i++;
            }
            let evaluation = '', jsfuck_index = 0;
            for(const node of next.value) {
                evaluation += (
                    jsfuck.substring(jsfuck_index, node.start) + 
                    eval(jsfuck.substring(node.start, node.end + 1))
                );
                jsfuck_index = node.end + 1;
            }
            evaluation += jsfuck.substring(jsfuck_index, jsfuck.length);
            console.log('\n' + evaluation + '\n');
            if(next.done) {
                console.log('The evaluation finished.');
                break;
            }
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
    jsfuck_eval(fs.readFileSync(process.argv[2], {encoding: 'ascii'}));
} else {
    console.log(`${CONSOLE_HEADER}\nUsage: nodejs ${process.argv[1]} <JSFuck script's pathname>`);
}
