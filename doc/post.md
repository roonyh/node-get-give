# A new module system for Node.js

Node.js does not need a new module system. Its existing implementation of a CommonJS module system works great. Even Facebook apparently gave up developing their module system which was named Haste. So I am building a new module system for Node.js not because I think the end product would be of any value, but because its a fun thing to do, and I might get to see a little deeper level of Node.js.

### How it will work

I name this new module system `get-give` because `get` and `give` will be the globals used to load new modules with it. I will create an executable named `node-get-give` that can be installed using npm. You can runt it just like the `node` executable.
```
node-get-give hello.js
```

`hello.js` is a JavaScript file that uses `get-give` module system. Here is an example.

```js
// hello.js
const capitalize = get('capitalize.js');

const hello = capitalize('Hello world!');

give(hello);
```

## `vm` module

Before I start I want to introduce you the [`vm` module](TODO:) from Node.js. `vm`'s responsibility in Node.js is excecuting JavaScript. Every single JavaScript line you write in you Node.js app, at somepoint, must ask this module to have it executed.

`vm` provide two important methods to facilitate this.

* vm.runInNewContext(someJSCode, theNewContext)
* vm.runInThisContext(someJSCode)

Context in these methods refer to the global state. Both methods run the JavaScript code stored in string variable someJSCode.

`runInThisContext` makes a brand new set of variables and functions, those inside the object `theNewContext` available to someJSCode as globals.

`runInThisContext` makes all the globals available to the script that runs it to be available to someJSCode

I will get these methods the moment I start building the new module system.

## The job of a module system

Its the job a module system to read contents of JavaScript files and run there content using the vm module. It should help these files communicate by passing results of callee to the caller.

The Node.js module system does just that and so will my new module system.

## I start coding

First I will create two files.

node-get-give.js will contain the code of `node-get-give`
hello.js will contain the JavaScript code that we will run using node-get-give.

For now I am using node directly to run it.

```
node node-get-give.js hello.js
```

Later I will create an executable so I don't have to explicitly use node command.

So I will start coding with putting some code in hello.js...

```js
// hello.js

console.log('hello world!');
```

...and trying to read it from node-get-give.js and run it through vm.

```
const vm = require('vm');
const fs = require('fs');

const moduleJs = fs.readFileSync('./hello.js')
vm.runInNewContext(moduleJs, {})
```

```
node node-get-give.js hello.js
```

Aaaand error!

```sh
evalmachine.<anonymous>:3
console.log('hello world!');
^
ReferenceError: console is not defined
```

## Enlightnment: `conosole` is not JavaScript

When I'm writing JavaScript, irrespective of whether its for the browser or Node.js, I use `console.log` statements a lot. And they work everytime. So naturally I thought it will work inside `vm`. I guess subconsiously I thought that `console` is a part of JavaScript. But as it turns out its just a global provided by the environment.

Above I used `runInNewContext`. So in this new context there is no console defined. One way to fix it is to pass `console` to `vm` using the second argument of `runInNewContext`.

```
vm.runInNewContext(moduleJs, {console})
```

But `console` is not the only global that we may use in our modules. There is a whole list of them documented in Node.js documentations. `process`, `require`, `exports`, to name a few. There is a similar list in the browser too. `window`

So if I want to pass in all the globals I may have to do something like,

```
vm.runInNewContext(moduleJs, {...globals})
```

But remembering that I have another method from `vm` at my disposal, I will use it instead.

```
const vm = require('vm');
const fs = require('fs');

const moduleJs = fs.readFileSync('./hello.js');
vm.runInThisContext(moduleJs);
```

The `get`

The tool now can run the JavaScript in the file `hello.js`. I will now add the `get` global to it so `hello.js` can load JavaScript from other files as well.

I will define this function inside node-get-give.js but I intend to use it inside hello.js and any other file that hello.js is going to load. Or shall we say require `get`?

One way to make it available to those later loaded modules is adding it to the context that `runInThisContext` uses. So we need to define it inside the global state of `node-get-give.js`. Defining it in following way does not work because that defines the get method in the local state of `node-get-give.js`

const get = () => {
  ...
}

In the last years JavaScript (ES5) omitting `const` or `var` would have worked but this year following is the way to define a global function.

```js
global.get = filename => {
  const loadedJS = fs.readFileSync(filename)
  vm.runInThisContext(loadedJS);
}
```

With that my `node-get-give.js` would like this.

```js
const vm = require('vm');
const fs = require('fs');

global.get = filename => {
  const loadedJS = fs.readFileSync(filename)
  vm.runInThisContext(loadedJS);
}

global.get(process.argv[2])
```

To demonstrate `node-get-give`'s current capabilities I will `get` a file named dog.js and from withing this dog.js I will get another file named cat.js. All files contain some stupid console.log statement.

```js
// hello.js
console.log('hello world!');
get('./dog.js')
```

```js
// dog.js
console.log('hello, I am a dog.')
get('./cat.js')
```

```js
// cat.js
console.log('hello, I am a cat.')
```

Run `node node-get-give.js hello.js`; Aaaand...

```
[aruna@mbp ~/experiments/node-get-give (master *)]$ node index.js hello.js
hello world!
hello, I am a dog.
hello, I am a cat.
```

Success!

Module scope

We already came across scopes of the module `node-get-give.js`. It has a local scope and a global scope. I defined `get` on its global scope.

But what about the modules that I load via `get`? Does `dog.js` and `cat.js` have global and local scopes?

To investigate this, I will define a variable named `name` in each of these modules.

```js
// dog.js
const name = 'Tom'
console.log(`hello, I am a dog named ${name}`);
```

```js
// cat.js
const name = 'Jerry'
console.log(`hello, I am a cat named ${name}`);
```

I will `get` both files in `hello.js`

```js
console.log('hello world!');
get('./dog.js')
get('./cat.js')
```

Aaaand run it.

hello world!
hello, I am a dog named Tom
evalmachine.<anonymous>:1
const name = 'Jerry'
^

TypeError: Identifier 'name' has already been declared.

Code in `cat.js` and `dog.js` runs in the same scope. Just because they live in two separate files does not make them run in scopes of their own. This problem can be traced to this line from `node-get-give.js`.


Every single module that will be loaded using our module system will go through this line. So every single module will be run in the context of `node-get-give.js`.

The problem of scopes in JavaScript is well discussed over many years. function and classes are the only items that have scopes in JavaScript. So to give these modules their own scope I'll have to stick them inside one of those.

Here is how I put code from each module inside a function.

```js
const wrap = moduleJS => (
  `(() => {${moduleJS}})()` // wrapping moduleJS ins a self calling arrow function
)

global.get = filename => {
  const loadedJS = fs.readFileSync(filename);
  const wrappedJS = wrap(loadedJS)
  vm.runInThisContext(wrappedJS);
}
```

Now running my command for `node-get-give` gives me the desired output.

```sh
[aruna@mbp ~/experiments/node-get-give (master *)]$ node index.js hello.js
hello world!
hello, I am a dog named Tom
hello, I am a cat named Jerry
```

