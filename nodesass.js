var loader = require("@loader");
var sassSync = "sass.js/dist/sass.sync.js";

// if we are on npm2 and we build your app with steal-tools, we are currently not in the
// steal-sass directory.
// we have to set the fully qualified path to the module
var sassLocation = __dirname + "/node_modules/" + sassSync;

try {
	// try to resolve the sass module on npm3
	sassLocation = loader._nodeRequire.resolve(sassSync);
} catch (e) {}

module.exports = loader._nodeRequire(sassLocation);