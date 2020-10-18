## JSFuck Debugger
Partially evaluates a [JSFuck][1]-encoded JavaScript source, making the obfuscated code readable.

## Install
It requires [Esprima][2] to build the Abstract Syntax Tree of the JSFuck code, so after cloning the repository run `npm i` inside its folder.

## Usage
Pass the JSFuck script's file as argument to `nodejs jsfuck-debugger`. The evaluator will prompt you for the number of evaluations to be done in next step until the whole code is evaluated.

This work in licensed under the MIT License.

[1]: https://en.wikipedia.org/wiki/JSFuck
[2]: https://github.com/jquery/esprima