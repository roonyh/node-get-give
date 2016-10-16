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
