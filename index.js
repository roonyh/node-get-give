const vm = require('vm');
const fs = require('fs');

const wrap = moduleJS => (
  `(() => {${moduleJS}})()`
)

global.get = filename => {
  const loadedJS = fs.readFileSync(filename);
  const wrappedJS = wrap(loadedJS)
  vm.runInThisContext(wrappedJS);
}

global.get(process.argv[2])
