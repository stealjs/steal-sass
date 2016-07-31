"use strict";
const css = require("$css");
const loader = require("@loader");

let instantiate = css.instantiate;

let buildType = "css";

// let fetch = function() {
// 	return '';
// };

let translate = function(load) {
	return loader.import(typeof window !== 'undefined' ? 'steal-sass/sass-inject' : 'steal-sass/sass-inject-build').then(function(sass) {
		return sass.default(load)
	});
};

module.exports = { instantiate, buildType, translate };