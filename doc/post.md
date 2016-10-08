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
