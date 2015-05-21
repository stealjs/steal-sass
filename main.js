var sass = require ("sass.js/dist/sass");
var css = require("$css");

exports.instantiate = css.instantiate;
exports.buildType = "css";

exports.translate = function(){
  return Promise.resolve(function(resolve){
    sass.compile(load.source, function(result){
      resolve(result);
    })
  });
}
