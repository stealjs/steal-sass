var Sass = require ("$sass");
var css = require("$css");
var loader = require("@loader");
var isNode = typeof process === "object" && {}.toString.call(process) ===
    "[object process]";

exports.instantiate = css.instantiate;
exports.buildType = "css";

exports.translate = function(load){
  var base = dir(load.address);
  load.source = fixRelativeImports(base, load.source);
  var imports = getImports(load.source);

  return getSass(this).then(function(sass){
    if(!isNode) {
      return preload(sass, base, imports);
    }
    return sass;
  }).then(function(sass){
    return new Promise(function(resolve, reject){
      sass.compile(load.source, function(result){
        if (result.status === 0 ) {
          return resolve(result.text);
        }
        reject(result.formatted);
      })
    });
  });
};

function dir(path){
  var parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function fixRelativeImports(base, sass) {
  var depth = base.split('/').length - 3;
  var modulesPath = Array(depth).fill('..').join('/') + '/node_modules/';
  return sass.replace(/(?<=@import ['"])~[/]?/gm, modulesPath);
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
