var loader = require("@loader");
// if we build your app with steal-tools, we are currently not in the steal-sass directory
// we have to set the fully qualified path to the module
module.exports = loader._nodeRequire(__dirname + "/node_modules/sass.js/dist/sass.sync.js");
