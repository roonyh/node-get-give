Node.js does not need a new module system. Its existing implementation of a CommonJS module system works great. Even Facebook apparently [gave up](https://github.com/facebookarchive/node-haste#unsupportedarchived) developing their internal module system, Haste. So the module system I am building is not of any production value but is just a fun weekend project.

### How it will work

I name this new module system `node-get` because `get` is the global used to load new modules with it. There's an executable named `node-get` that can be installed using `npm -g node-get-modules`. You can run it just like the `node` executable.

```
$ node-get hello.js
```

Where `hello.js` is a JavaScript file that uses `node-get` module system. Here's an example.

```js
// hello.js
const capitalize = get('capitalize.js');
const hello = capitalize('hello world!');
console.log(hello) // Prints Hello World!
```

But in this post, I'll use node directly to run it because it requires no set up and works anywhere.

```
$ node node-get.js hello.js
```

I am using Node.js version 6 to build `node-get` so the code here uses ES6 syntax. Everything should work in node version 4 as well.

### `vm` module

First, I want to introduce you the [`vm` module](https://nodejs.org/api/vm.html) from Node.js. `vm`'s responsibility is executing JavaScript. Every single JavaScript file you write in your Node.js app must contact this module at some point to have it executed.

`vm` provides two methods to facilitate this.

* vm.runInNewContext(someJSCode, theNewContext)
* vm.runInThisContext(someJSCode)

*Context* in these methods refer to the global state. Both methods execute the JavaScript code stored in string variable `someJSCode`. They differ only by the global variables they allow `someJSCode` to use.

`runInThisContext` makes a brand new set of variables and functions using entries in `theNewContext` object and makes them available to `someJSCode` as globals.

`runInThisContext` makes all the globals available to the script that runs it, to be available to `someJSCode` as well.

I will get to these methods the moment I start building the new module system.

### The job of a module system

It's the job a module system to read contents of JavaScript files and run their content using the vm module. It should help these files communicate by passing results of the callee to the caller.

The Node.js module system, with `require` and `exports`, does just that and so will my new module system.

### I start coding

I'll start to code; feel free to follow along if you like.

First I'll create two files.

`node-get.js` will contain the actual code of `node-get`, my new module system.
`hello.js` will contain the JavaScript code that I will run using node-get. It will demonstrate the features of `node-get`

I'll put some code in hello.js.

```js
// hello.js
console.log('hello world!');
```

I'll start `node-get.js` with following code. It's using `runInNewContext` from the `vm` module.

```js
const vm = require('vm');
const fs = require('fs');

// Read the module
const moduleJS = fs.readFileSync('./hello.js')

// Create an empty context
context = {};

// Execute JavaScript from hello.js
vm.runInNewContext(moduleJs, context)
```

I am extracting the content of hello.js into a variable named `moduleJS` and executing them using the introduced `vm.runInNewContext`. Since `context` is just an empty object, JavaScript in `moduleJS` does not have access to any global variables.

I'll run the program to see how it go.

```
$ node node-get.js hello.js
```

Aaaand error!

```
evalmachine.<anonymous>:3
console.log('hello world!');
^
ReferenceError: console is not defined
```

### Enlightnment: `conosole` is not JavaScript

When I'm writing JavaScript, irrespective of whether it's for the browser or Node.js, I use `console.log` statements a lot. And they work every time. So naturally I thought it will work inside `vm`. I guess subconsciously I thought that `console` is a part of JavaScript. But as it turns out it's just a global provided by the environment.

Above I used `runInNewContext`. So in this new context there is no `console` defined. One way to fix it is to add `console` to the context.

```js
context = {console}; // Now contex has a console
vm.runInNewContext(moduleJs, context);
```

This does work for now, But `console` is not the only global that we may use in our modules. There is a [whole list of them](https://nodejs.org/api/globals.html) documented in Node.js documentation. `process`, `Buffer`, `setTimeout`, to name a few.

So if I want to pass in all the globals I'll have to do something like,

```
vm.runInNewContext(moduleJs, {...globals})
```

But remembering that I have another method from `vm` at my disposal, I will use it instead.

```js
const vm = require('vm');
const fs = require('fs');

const moduleJs = fs.readFileSync('./hello.js');
vm.runInThisContext(moduleJs);
```

`hello.js` now have access to any global available to `node-get.js`. It works now!

```
$ node node-get.js hello.js
hello world!
```

### The `get`

I will now add the `get` global so `hello.js` can load JavaScript from other files as well.

I will define this function inside `node-get.js` but I intend to use it inside `hello.js` and inside any other module that `hello.js` might load(`get`).

Remember that any global available to `node-get.js` is available to JavaScript code that goes through `runInThisContext`. So we need to define `get` as a global inside `node-get.js`.

```js
global.get = filename => {
  const loadedJS = fs.readFileSync(filename)
  vm.runInThisContext(loadedJS);
}
```

With that, my `node-get.js` looks like this.

```js
// node-get.js
const vm = require('vm');
const fs = require('fs');

global.get = filename => {
  const loadedJS = fs.readFileSync(filename)
  vm.runInThisContext(loadedJS);
}

global.get(process.argv[2])
```

Note that I am using `process.argv[2]` to get the entry point to the app instead of hardcoded `hello.js`.

This entry point module have access to `get` as a global and any module that's loaded using `get('any JS file')` will to. So recursively any module in the example project can use get.

To demonstrate these capabilities of `node-get`, from `hello.js` I will `get` a file named `cat.js` and from within this `cat.js` I will `get` another file named `mouse.js`. All files contain some dumb `console.log` statement.

```js
// hello.js
console.log('hello world!');
get('./cat.js')
```

```js
// cat.js
console.log('hello, I am a cat.')
get('./mouse.js')
```

```js
// mouse.js
console.log('hello, I am a mouse.')
```

Run `node node-get.js hello.js`; Aaaand...

```
$ node node-get.js hello.js
hello world!
hello, I am a cat.
hello, I am a mouse.
```

Success!

### Module scope

So, for now, everything seems to work fine. Let's add more JavaScript to our modules. I'll start with variables.
I will define a variable named `name` in each of `cat.js` and `mouse.js` modules.

```js
// cat.js
const name = 'Tom'
console.log(`hello, I am a cat named ${name}`);
```

```js
// mouse.js
const name = 'Jerry'
console.log(`hello, I am a mouse named ${name}`);
```

This time, I will `get` both modules in `hello.js`

```js
// hello.js
console.log('hello world!');
get('./cat.js')
get('./mouse.js')
```

Aaaand run it.

```
$ node node-get.js hello.js
hello world!
hello, I am a cat named Tom
evalmachine.<anonymous>:1
const name = 'Jerry'
^

TypeError: Identifier 'name' has already been declared.
```

Variables defined in a Node.js(CommonJS) module are local to that module. Unless we export them using `exports` we can't access them outside the module. But code in `cat.js` and `mouse.js` apparently run in the same scope.

Just because they live in two separate files does not make them run in two separate scopes. This problem can be traced to this line from `node-get.js`.

```js
vm.runInThisContext(loadedJS);
```

Every single module that will be loaded using our module system will go through this line. So every single module will be run in the context of `node-get.js`; And in the scope of the `get` function.

The problem of scopes in JavaScript is well discussed over many years. Before ES6 functions are the only constructs in JavaScript that had a scope of their own. (ES6 introduced classes, `let` and `const`) So to give these modules their own scope I'll have to stick them inside one.

I'll write a function called wrap which returns the code of a JavaScript function containing JavaScript code from the module.

```js
const wrap = moduleJS => (
  `(() => {${moduleJS}})()` // wrapping moduleJS in a self calling arrow function
)

global.get = filename => {
  const loadedJS = fs.readFileSync(filename);
  const wrappedJS = wrap(loadedJS)
  vm.runInThisContext(wrappedJS);
}
```

Now contents of the loaded module are put inside a function. This function calls itself.

This fixes `node-get`'s scope problem so I get the desired output.

```
$ node node-get.js hello.js
hello world!
hello, I am a cat named Tom
hello, I am a mouse named Jerry
```

### `get` relative paths

So now my module system is working pretty well. Currently, my Hello-Tom&Jerry project's and `node-get`s files are all in the same directory. I'll tidy up things a bit by moving the example project's files into a directory aptly named 'example'.
```
├── example
│   ├── cat.js
│   ├── mouse.js
│   └── hello.js
└── node-get.js
```

I shouldn't need to change anything inside `hello.js` since I used relative paths to `get` other modules in it. And relative paths would be the same in this directory structure as well.

Let's see how that works out.

```
$ node node-get.js example/hello.js

hello world!
fs.js:640
  return binding.open(pathModule._makeLong(path), stringToFlags(flags), mode);
                 ^

Error: ENOENT: no such file or directory, open './cat.js'
```

I was used to `require` files with paths relative to the module I am calling `require` in, I thought `get` will work the same way. But turns out I need to do a bit of work to get it to work that way.

Let's first understand why it did not work this way.

The `fs` module is what we use to read the contents in loaded modules from `node-get.js`

fs module actually resolves relative paths relative to the current working directory of the process. Say I run `node-get` from `cwd/node-get`. So when `get('./cat.js')` is called inside `hello.js`(or anywhere else) where it looks for it is `cwd/cat.js`. It's not going to find a cat.js there because I just moved it into a directory named `example` so it's in `cwd/example/cat.js`

I'd like `get` to resolve relative paths the same way `require` does. So I want the `get` global method in each of my modules to resolve relative modules relative to its own self. So `get` in each module should work in a way that is specific to that module. The best way I could achieve this is providing each module with its own specific instance of `get`.

So first I'll change `wrappedFunction` to take a `get` parameter.

```js
const wrap = moduleJS => (
  `(get => {${moduleJS}})`
)
```

Note that the `wrappedFunction` is not self-calling anymore. (I have taken out the `()` at the end.) Instead, it's returned to the place where `runInThisContext` is called so it can be called from there.

Now I'll change the `get` function.

I have already decided that I need a specific `get` function for each new module. So instead of one single global `get` function, I will create a `get` factory function named `createGet` so I can create any number of `get`s from it. Each created `get` is different from another because each `get` function has a `caller` specific to that particular `get`.

Here is the `createGet` function with each line following a comment describing it.

```js
const createGet = caller => {
  return filename => {
    // Get the directory the caller is in
    const callersDirectory = path.dirname(caller);

    // resolve relative path relative to the caller's directory
    const filepath = path.resolve(callersDirectory, filename);

    // Read the content in loaded file
    const loadedJS = fs.readFileSync(filepath);

    // wrap it inside the wrapper function. It's not immediately called now
    const wrappedJS = wrap(loadedJS)

    // Run the content through vm. This returns the wrapped function so we can call it later
    const newModule = vm.runInThisContext(wrappedJS);

    // Create a new get to be used in this new module, using createGet itself. Bit of a recursion :)
    const newGet = createGet(filename);

    // Call the newModule (wrappedFunction) with the created `get`
    newModule(newGet);
  }
}
```

When a `get` is passed a relative file path, it is resolved relative to the `get` function's `caller`s location.

Here's the latest `node-get.js`.

```js
// node-get.js
cconst vm = require('vm');
const fs = require('fs');
const path = require('path');

const wrap = moduleJS => (
  `(get => {${moduleJS}})`
)

const createGet = caller => {
  return filename => {
    const callersDirectory = path.dirname(caller);
    const filepath = path.resolve(callersDirectory, filename); // Paths resolved relative to caller's directory
    const loadedJS = fs.readFileSync(filepath);
    const wrappedJS = wrap(loadedJS)
    const newModule = vm.runInThisContext(wrappedJS);

    const newGet = createGet(filename);

    newModule(newGet);
  }
}

// The entry point to the app does not have a caller. So we create an artificial one.
const rootCaller = path.join(process.cwd(), '__main__');
const rootGet = createGet(rootCaller);
rootGet(process.argv[2])
```

Now relative paths work the way we are familiar with and I get the expected output.

```
$ node node-get.js example/hello.js
hello world!
hello, I am a cat named Tom
hello, I am a mouse named Jerry
```

### `give`

Currently when `get` is used to load another JavaScript file the contents of that file is executed. But with Node.js modules we can return the results of this execution to the caller to be used later. (Using `exports`)
```js
const fs = require('fs');
fs.readFileSync('somefile') // Like this.
```

Now I'll implement the same functionality in `node-get`.

I'll provide each module with a `give` function to complement the `get` it already has. `give` can be used in the following way.

```js
// capitalize.js
const capitalize = () => { /*function logic*/ }
give(capitalize)
```

First, I'll change the wrapperFunction to accept another parameter, `give`.

```js
const wrap = moduleJS => (
  `((get, give) => {${moduleJS}})`
)
```

I'll implement `give` in the `createGet` function itself.

```js
const createGet = caller => {
  return filename => {
    const callersDirectory = path.dirname(caller);
    const filepath = path.resolve(callersDirectory, filename); // Paths resolved relative to caller's directory
    const loadedJS = fs.readFileSync(filepath);
    const wrappedJS = wrap(loadedJS)
    const newModule = vm.runInThisContext(wrappedJS);

    const newGet = createGet(filepath);

    let givenValue;
    const newGive = value => { givenValue = value }

    newModule(newGet, newGive); // Pass new give along side new get.

    return givenValue;
  }
}
```

It's very simple to implement give. It takes the `value` passed to it and assigns it to `givenValue` which is returned from the outer `get` function. This would mean that only the last `give` call from a module will take effect.

This completes my new module system and I feel quite clever!

Here are the files from my example project updated to demonstrate the latest features of `node-get`.

```js
// utils/capitalize.js
// Lifted from stackoverflow: http://stackoverflow.com/a/7592235/1150725
const capitalize = text => {
    return text.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
}
give(capitalize)
```

```js
// cat.js
const capitalize = get('./utils/capitalize.js')
const name = 'Tom'
give(capitalize(`hello, I am a cat named ${name}`));
```

```js
// mouse.js
const capitalize = get('./utils/capitalize.js')
const name = 'Jerry'
give(capitalize(`hello, I am a mouse named ${name}`));
```

```js
// hello.js
console.log('hello world!');

const catText = get('./cat.js');
console.log(catText);

const mouseText = get('./mouse.js');
console.log(mouseText);
```

Here is the completed `node-get.js`.

```js
// node-get.js
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const wrap = moduleJS => (
  `((get, give) => {${moduleJS}})`
)

const createGet = parent => {
  return filename => {
    const parentsDirectory = path.dirname(parent);
    const filepath = path.resolve(parentsDirectory, filename); // Paths resolved relative to parent's directory
    const loadedJS = fs.readFileSync(filepath);
    const wrappedJS = wrap(loadedJS)
    const newModule = vm.runInThisContext(wrappedJS);

    const newGet = createGet(filepath);

    let givenValue;
    const newGive = value => { givenValue = value }

    newModule(newGet, newGive);

    return givenValue;
  }
}

// The entry point to the app does not have a parent. So we create an artificial one.
const rootParent = path.join(process.cwd(), '__main__');
const rootGet = createGet(rootParent);
rootGet(process.argv[2])
```

I'll run `node-get` one last time.

```
$ node node-get.js example/hello.js
hello world!
Hello, I Am A Cat Named Tom
Hello, I Am A Mouse Named Jerry
```

### Comparison with Node.js module system

Node.js module system works very similar to the module system I just built.

* Node.js module system reads a new module using `fs.readFileSync` and executes its JavaScript using `vm.runInThisContext` just the way `node-get` does.

* It also wraps JavaScript files inside a [wrapperFunction](https://nodejs.org/api/modules.html#modules_the_module_wrapper) to give them a local scope. In fact, this wrapper can be looked at using the `module` module. Let me show.

```
$ node
> const m = require('module')
> m.wrap("somejs")
'(function (exports, require, module, __filename, __dirname) { somejs\n});'
```

See that its signature is quite similar to `node-get`'s wrapper function's.

* It also has a `require` function specific to each module and uses this fact to resolve relative paths relative to the module's location

These similarities are there because `node-get` is built using the understanding I got of Node.js module system by going through its source.

And of course, Node.js module system has many additional features as well.

* When a module is `require`d, it is cached. So later `require`s to the same module will be faster. This also means that they act as singletons. (A module is executed only once)
* It has `node_modules`. When `require` is called with an absolute path it looks in several locations including a `node_modules` directory in the root of the project.
* You can `require` JSON files with it.

These features are not that complex. I bet you could think of ways to implement them into `node-get` if needed.

This excercise helped me to get some subtle understanding of Node.js. I hope you enjoyed reading about it.

Despite what is commonly said, I really think that JavaScript is alright. I love Node.js for allowing me to do a great many things with it.

I plan to hack deeper into Node.js, and write about my experiments with it. Stay tuned!
