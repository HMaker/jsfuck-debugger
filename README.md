## JSFuck Debugger
Partially evaluates a [JSFuck][1]-encoded JavaScript source making the obfuscated code readable.

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

[1]: http://www.jsfuck.com/