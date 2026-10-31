/* What a module's own checks load: plugin.js (the door), the module's files in files.js's order, and test/start.js, which
   does for the one module what main.js does for all of them. The checks live in each module's test/ folder:
     const { root, order } = require('../../test/module.js')('look'); */
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
module.exports = (folder, also = []) => {
  const listed = fs.readFileSync(path.join(root, 'files.js'), 'utf8').match(/'([a-z/-]+\.js)'/g).map(s => s.slice(1, -1));
  return { root, order: ['plugin.js', ...also, ...listed.filter(file => file.startsWith(folder + '/')), 'test/start.js'] };
};
