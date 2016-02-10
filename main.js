var Sass = require ("$sass.js");
var css = require("$css");
var loader = require("@loader");
var isNode = typeof process === "object" && {}.toString.call(process) === "[object process]";

exports.instantiate = css.instantiate;
exports.buildType = "css";

var META = {
  ___concatenated_source: "",
  ___import_hash: {},
  ___load_stack: []
};

exports.translate = function(load){
  return getSass(this).then(function(sass) {
    console.log("======================", load.address, load.source.length);

    var promise;
    var start;
    if (META.___load_stack.length) {
      promise = META.___load_stack[0].then(function () {
        start = Date.now();
        return processUrl(load.address, load.source, load);
      });
    } else {
      start = Date.now()
      promise = processUrl(load.address, load.source, load);
    }

    // promise = promise.then(function () {
    //   return new Promise(function(resolve) {
    //     var delay = META.___load_stack.length === 1 ? 200 : 10;
    //     setTimeout(resolve, delay);
    //   });
    // });

    META.___load_stack.unshift( promise );
    //META.___import_hash[load.address] = Promise.resolve();
    
    return promise.then(function () {
      console.log("It took", (Date.now() - start), "ms to import (", load.source.indexOf("@import"), "occurances of @import)", load.address);
      return sass;
    });
  }).then(function(sass){
    var promise = META.___load_stack.pop();
    
    META.___concatenated_source += load.source;

    // If this is the last promise in the stack, then compile
    if ( !META.___load_stack.length ) {
      return new Promise(function(resolve){
        promise.then(function () {
          runCompile(sass, META.___concatenated_source, resolve,           load.address);
        });
      });
    } else {
      // Resolve the previous resolver - the last one is the only one that will resolve with content
      return "";
    }
  });
};

function runCompile (sass, source, resolve, address) {
  var start = Date.now();
  console.log("COMPILING (", source.length, ")", address);
  sass.compile(source, function(result){
    console.log("It took", (Date.now() - start), "ms to compile: ", address);
    if (result.status > 0) {
      console.error("STEAL-SASS ERROR", result.status, "-", result.message);
      console.log(source);
      resolve("");
      return;
    }
    // console.log("HAS REMOVE STATEMENT:", result.text.indexOf(REMOVE_START));
    resolve(result.text);
  });
}

function getBase(path){
  if(isNode) {
    path = path.replace("file:" + process.cwd() + "/", "");
  }
  path = path.replace(/https?:\/\/[^\/]+\//, "")

  var parts = path.split("/");
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

function processUrl(url, source, load) {
  var imports = getImports(source);
  var index = 0;

  if ( !imports.length ) {
    return Promise.resolve(source);
  }

  var base = getBase(url);
  var stack = [], i, l;
  for (i = 0, l = imports.length; i < l; i++) {
    (function (importName) {
      var importRegex = new RegExp("@import.+?['\"]" + importName + "['\"]");
      var promise = DO_IMPORT(importName, importRegex, base, load).then(function (result) {
        source = source.replace(importRegex, result);
        return result;
      });
      stack.push(promise);
    }(imports[i]));
  }

  return Promise.all(stack).then(function () {
    return source;
  });
}

function DO_IMPORT (file, importRegex, base, load) {
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
  load.source = load.source.replace(importRegex, importKey);

  if (META.___import_hash[importKey]) {
    return META.___import_hash[importKey].then(function (result) {
      // load.source = load.source.replace(importKey, result);
      load.source = load.source.replace(importKey, "");
      
      return result;
    });
  }

  META.___import_hash[importKey] = loader.normalize(file, base).then(function (name) {
    return loader.locate({ name: name, metadata: {} }).then(function (url) {
      url = url.split("!")[0];

      // If the file is already being loaded, then surround it with remove statements
      if (META.___import_hash[url]) {
        return META.___import_hash[url].then(function (result) {
          // load.source = load.source.replace(importKey, result);
          load.source = load.source.replace(importKey, "");
          return result;
        });
      }

      META.___import_hash[url] = loader.fetch({ name: name, address: url, metadata: {} }).then(function (result) {
        load.source = load.source.replace(importKey, result);

        return processUrl(url, result, load).then(function (finalResult) {
          return finalResult;
        });
      });

      return META.___import_hash[url];
    });
  });

  return META.___import_hash[importKey];
};

var sassProcessor = isNode ? "sass.js/dist/sass.sync" : "sass.js/dist/sass.worker";
var getSass = function (loader, newInstance) {
  return loader.normalize(sassProcessor, "steal-sass").then(function(name){
    return loader.locate({ name: name });
  }).then(function (url) {
    var sass;
    if (isNode) {
      var oldWindow = global.window;
      url = url.replace("file:", "");
      delete global.window;
      delete loader._nodeRequire.cache[url];
      sass = loader._nodeRequire(url);
      global.window = oldWindow;
    } else {
      sass = new Sass(url);
    }
    return sass;
  });
};
