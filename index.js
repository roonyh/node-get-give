const vm = require('vm');
const fs = require('fs');

const moduleJs = fs.readFileSync('./hello.js')
vm.runInThisContext(moduleJs, {})