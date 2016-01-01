var Sass = require ("$sass.js");
var css = require("$css");
var loader = require("@loader");
var isNode = typeof process === "object" && {}.toString.call(process) === "[object process]";

exports.instantiate = css.instantiate;
exports.buildType = "css";

exports.translate = function(load){
  var base = dir(load.address);
  var imports = getImports(load.source);

  console.log("======================", load.address);

  return getSass(this).then(function(sass) {
    // this will only happen once
    if (typeof sass.___concatenated_source === "undefined") {
      sass.___concatenated_source = "";
      sass.___import_hash = {};
      sass.___load_stack = [];
    }

    clearTimeout(sass.___compile_timer);

    if(isNode) {
      base = base.replace("file:" + process.cwd() + "/", "");
    }

    var promise;
    if (sass.___load_stack.length) {
      promise = sass.___load_stack[0].then(function () {
        return preload(sass, base, imports, load);
      });
    } else {
      promise = preload(sass, base, imports, load)
    }

    sass.___load_stack.unshift( promise );

    return promise;
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
        console.log("COMPILING");
        runCompile(sass, resolve);
      }, 50);
    });
  });
};

function runCompile (sass) {
  // console.log("runCompile", sass.___concatenated_source);
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

      importKey = base + "|" + file;

      sass.___import_hash[importKey] = loader.normalize(file, base).then(function (name) {
        if (sass.___import_hash[name]) {
          load.source = load.source.replace(importRegex, "");

          return new Promise(function(resolve) {
            sass.___import_hash[name].then(function () {
              resolve(sass);
            });
          });
        }

        sass.___import_hash[name] = Promise.resolve(loader.locate({ name: name, metadata: {} })).then(function (url) {
          return loader.fetch({ name: name, address: url, metadata: {} }).then(function (result) {
            var imports = getImports(result);
            
            load.source = load.source.replace(importRegex, result);

            if (imports.length) {
              return preload(sass, dir(url), imports, load);
            }
            return sass;
          });
        });

        return sass.___import_hash[name];
      });

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
