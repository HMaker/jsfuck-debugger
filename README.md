## JSFuck Debugger
Partially evaluates a [JSFuck][1]-encoded JavaScript source, making the obfuscated code readable.

## Install
It requires [Esprima][2] to build the Abstract Syntax Tree of the JSFuck code, so after cloning the repository run `npm i` inside its folder.

## Usage
```
git clone https://github.com/HMaker/jsfuck-debugger.git
cd jsfuck-debugger
npm install
nodejs . jsfuck-sample.txt
```

## Warning
Don't evaluate untrusted code. `jsfuck-debugger` uses `new Function(...)()` construct to evaluate the code inside the modules' global scope.

This work in licensed under the MIT License.

[1]: https://en.wikipedia.org/wiki/JSFuck
[2]: https://github.com/jquery/esprima