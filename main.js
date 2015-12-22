var Sass = require ("$sass.js");
var css = require("$css");
var loader = require("@loader");
var isNode = typeof process === "object" && {}.toString.call(process) === "[object process]";

exports.instantiate = css.instantiate;
exports.buildType = "css";

exports.translate = function(load){
  var base = dir(load.address);
  var imports = getImports(load.source);

  return getSass(this).then(function(sass) {
    if (typeof sass.___concatenated_source === "undefined") {
      sass.___concatenated_source = "";
      sass.___import_hash = {};
    }

    clearTimeout(sass.___compile_timer);

    if(isNode) {
      base = base.replace("file:" + process.cwd() + "/", "");
    }
    return preload(sass, base, imports, load);
  }).then(function(sass){
    clearTimeout(sass.___compile_timer);

    console.log("It took", (Date.now() - sass.startTime), "ms to import (", load.source.indexOf("@import"), "occurances of @import)", load.address);
    return new Promise(function(resolve){
      sass.startTime = Date.now();
      sass.___concatenated_source += load.source;

      // Resolve the previous resolver - the last one is the only one that will resolve with content
      if (sass.___compile_resolver) {
        sass.___compile_resolver("");
      }

      sass.___compile_resolver = resolve;
      clearTimeout(sass.___compile_timer);
      sass.___compile_timer = setTimeout(function () {
        runCompile(sass, resolve);
      }, isNode ? 10 : 300);
    });
  });
};

function runCompile (sass) {
  sass.compile(sass.___concatenated_source, function(result){
    console.log("It took", (Date.now() - sass.startTime), "ms to compile");
    if (result.status > 0) {
      console.error("STEAL-SASS ERROR", result.status, "-", result.message);
      sass.___compile_resolver("");
      return;
    }
    sass.___compile_resolver(result.text);
  });
}

function dir(path){
  var parts = path.replace(/https?:\/\/[^\/]+\//, "").split("/");
  parts.pop();
  return parts.join("/") + "/";
}

var importExp = /@import.+?['"](.+?)['"]/g;
function getImports(source){
  var imports = [];
  source.replace(importExp, function(whole, imp){
    imports.push(imp);
  });
  return imports;
}

function preload(sass, base, files, load) {
  if(!files.length) return Promise.resolve(sass);

  var stack = [];
  for (var i = 0, l = files.length; i < l; i++) {
    (function (importName) {
      var file = importName;
      var importRegex = new RegExp("@import.+?['\"]" + importName + "['\"]");
      var importKey;

      // SCSS allows for a shortname syntax "foo/bar", which will try to find "foo/_bar.scss" on the filesystem.
      if ( !/\.scss$/.test(file) ) {
        var parts = file.split("/");
        parts.push("_" + parts.pop() + ".scss");
        file = parts.join("/");
      }

      // CSS imports allow relative paths using @import "foo/bar.css" - we have to fix this for SystemJS
      // If the file doesn't start with "./", "../", or the base path, make it relative
      if ( !/^\.\.?\//.test(file) && file.indexOf(base) !== 0 ) {
        file = "./" + file;
      }

      importKey = base + "---" + file;

      if (sass.___import_hash[importKey]) {
        load.source = load.source.replace(importRegex, "");
      } else {
        sass.___import_hash[importKey] = loader.normalize(file, base).then(function (name) {
          return Promise.resolve(loader.locate({ name: name, metadata: {} })).then(function (url) {
            return loader.fetch({ name: name, address: url, metadata: {} }).then(function (result) {
              var imports = getImports(result);
              
              load.source = load.source.replace(importRegex, result);

              if (imports.length) {
                return preload(sass, dir(url), imports, load);
              }
              return sass;
            });
          });
        });
      }

      stack.push(sass.___import_hash[importKey]);

    }(files[i]));
  }

  return Promise.all(stack).then(function () {
    return sass;
  });
}

var getSass = (function(){
  if(isNode) {
    return function(loader){
      var np = Promise.resolve(loader.normalize("sass.js/dist/sass.sync", "steal-sass"));
      return np.then(function(name){
        return Promise.resolve(loader.locate({ name: name }));
      }).then(function(url){
        var oldWindow = global.window;
        delete global.window;
        var sass = loader._nodeRequire(url.replace("file:", ""));
        global.window = oldWindow;
        getSass = function() { return Promise.resolve(sass); };
        sass.startTime = Date.now();
        return sass;
      });
    };
  }

  return function(loader){
    var np = Promise.resolve(loader.normalize("sass.js/dist/sass.worker", "steal-sass"));
    return np.then(function(name){
      return Promise.resolve(loader.locate({ name: name }));
    }).then(function(url){
      var sass = new Sass(url);
      sass.startTime = Date.now();
      getSass = function() { return Promise.resolve(sass); };
      return sass;
    });
  };
})();
