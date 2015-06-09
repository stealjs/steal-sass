var Sass = require ("sass.js/dist/sass");
var css = require("$css");

exports.instantiate = css.instantiate;
exports.buildType = "css";

exports.translate = function(load){
  var base = dir(load.address);
  var imports = getImports(load.source);

  return getSass(this).then(function(sass){
    return preload(sass, base, imports);
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
  return function(loader){
    var np = Promise.resolve(loader.normalize("sass.js/dist/sass.worker", "steal-sass"));
    return np.then(function(name){
      return Promise.resolve(loader.locate({ name: name }));
    }).then(function(url){
      var sass = new Sass(url);
      getSass = function() { return sass; };
      return sass;
    });
  };
})();
