var Sass = require ("$sass");
var css = require("$css");
var loader = require("@loader");
var isNode = typeof process === "object" && {}.toString.call(process) ===
    "[object process]";

exports.instantiate = css.instantiate;
exports.buildType = "css";

exports.translate = function(load){
  var base = dir(load.address);
  var imports = getImports(load.source);

  return getSass(this).then(function(sass){
    if(!isNode) {
      return preload(sass, base, imports);
    }
    return sass;
  }).then(function(sass){
    return new Promise(function(resolve){
      sass.compile(load.source, function(result){
        resolve(result.text);
      })
    });
  });
};

function dir(path){
  var parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

var importExp = /@import.+?"(.+?)"/g;
function getImports(source){
  var imports = [];
  source.replace(importExp, function(whole, imp){
    imports.push(imp);
  });
  return imports;
}

function preload(sass, base, files){
  if(!files.length) return Promise.resolve(sass);

  return new Promise(function(resolve){
    sass.preloadFiles(base, "", files, function(){
      resolve(sass);
    });
  });
}

var getSass = (function(){
  if(isNode) {
    return function(loader){
      return Promise.resolve(Sass);
    };
  }

  return function(loader){
    var np = Promise.resolve(loader.normalize("sass.js/dist/sass.worker", "steal-sass"));
    return np.then(function(name){
      return Promise.resolve(loader.locate({ name: name, metadata: {} }));
    }).then(function(url){
      var sass = new Sass(url);
      getSass = function() { return Promise.resolve(sass); };
      return sass;
    });
  };
})();
