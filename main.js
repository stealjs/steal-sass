var Sass = require ("$sass.js");
var css = require("$css");
var loader = require("@loader");
var isNode = typeof process === "object" && {}.toString.call(process) === "[object process]";
var isBuild = isNode && /build$/.test(process.argv[1]);

var fs;
var DEV_CSS_PATH = "src/css/dev";
var BUILD_CSS_PATH = "src/css/build";

if (isNode) {
  fs = loader._nodeRequire("fs");
}

// Create the directory where the compiles CSS will live in dev mode
function createDir (parts, i) {
  i = i || 0;
  if (typeof parts === "string") {
    parts = parts.split("/").filter(Boolean);
  }
  var path = parts.slice(0, ++i).join("/");
  fs.mkdir(path, function (err) {
    if (err && err.code !== "EEXIST") {
      throw new Error(err);
    }
    if (i < parts.length) {
      createDir(parts, i);
    }
  });
}
if (isNode && !isBuild) {
  createDir(DEV_CSS_PATH);
}
if (isBuild) {
  createDir(BUILD_CSS_PATH);
}

exports.instantiate = css.instantiate;
exports.buildType = "css";

var META = {
  ___concatenated_source: "",
  ___import_hash: {},
  ___load_stack: [],
  ___is_importing: false
};

// If in the browser we don't find the <style> tag on the page, set
// hasCompiled to true to ensure the styles get compiled on the first pass.
if (!isNode) {
  var links = document.head.querySelectorAll("link[rel=stylesheet]");
  var found = false;
  for (var i = 0; i < links.length; i++) {
    if (links[i].href.indexOf(DEV_CSS_PATH) > -1) {
     found = true;
     break;
    }
  }
  if (!found) {
    window.SASS_CACHE = {};
  }
}

// This file only runs in development mode. This is a very specific implementation to Levi's
// and should considered both stable yet unconventional. The way in which we are compiling
// SASS files is crucial to the workflow we implemented for Levi's, but it results in a 
// preventatively long compile time in the browser. In order to mitigate this, we offload initial
// SASS compiling to the server and provide a way for the browser to then piggyback on that 
// compiled code. Here's the flow:
//  1. During first page load compile on the server and write to a file in the file system
//  2. <link> to the compiled CSS file from the app component.
//    a. In browser (dev mode), the initial page load will use the compiled CSS.
//    b. Individual SASS files are still loaded in the background. Any route changes will then 
//       be compiled in the browser.
//  3. After the build:
//    a. Run a script to concatenate all compiled CSS files in the /dist folder
//    b. Run another script to optimize the final CSS - remove duplicate selectors, etc.
//    c. Make sure the final CSS file is <link>ed to in the app component - use versioning
//    d. Flag the CSS bundles as loaded so that steal doesn't try to load them (see config/env.js)

exports.translate = function(originalLoad) {
  var load = {};
  for (var prop in originalLoad) {
    load[prop] = originalLoad[prop];
  }

  // strip the domain from the address
  var loadPath = load.address.replace(/^https?:\/\/[^\/]+\//, '');

  var loadPromise = getSass(this).then(function(sass) {
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

    // A slight delay is needed to allow the stack to build up and
    // minimize the number of compilations which take place.
    promise = promise.then(function () {
      return new Promise(function(resolve) {
        setTimeout(resolve);
      });
    });

    META.___load_stack.unshift( promise );
    META.___import_hash[load.address] = promise;

    promise.then(function () {
      console.log("It took", (Date.now() - start), "ms to import (", load.source.indexOf("@import"), "occurances of @import)", load.address);
    });

    return promise.then(function () {
      if (promise === META.___load_stack[0]) {
        return new Promise(function (resolve) {
          setTimeout(function () {
            META.___using_sass = null;
            resolve(sass);
          }, 200);
        })
      }
      return sass;
    });
  }).then(function(sass){
    var promise = META.___load_stack.pop();
    
    META.___concatenated_source += load.source;

    // If there are still files in the stack, return early. We want to compile
    // the entire stack all at once.
    if (META.___load_stack.length) {
      return "";
    }

    // On first page load, the sass object is an empty object - so don't try to compile
    if (!isNode && !sass.compile) {
      return "";
    }

    return new Promise(function(resolve){
      promise.then(function () {
        runCompile(sass, META.___concatenated_source, resolve,           load.address);
      });
    });
  });

  // On initial page load, returning early like this allows the page to load
  // without waiting on the SASS files to load.
  if ( !isNode && SASS_CACHE.hasOwnProperty(loadPath) ) {
    delete SASS_CACHE[loadPath];
    return "";
  }

  return loadPromise;
};

function runCompile (sass, source, resolve, address) {
  var start = Date.now();
  var compilerMethod = isNode ? sass.render : sass.compile;
  var payload = isNode ? { data: source } : source;

  console.log("COMPILING (", source.length, ")", address);
  compilerMethod(payload, function(err, result){
    // The browser compiler only sends one parameter, so normalize it here
    if (!isNode) {
      result = err;
      if (result.status === 0) {
        err = null;
      }
    }

    console.log("It took", (Date.now() - start), "ms to compile: ", address);
    if (err) {
      console.error("STEAL-SASS ERROR", err.status, "-", err.message);
      resolve("");
      return;
    }
    
    // write the dev CSS to the file system.
    if ( isNode && !isBuild) {
      fs.writeFile(DEV_CSS_PATH + "/dev-css.css", result.css, function (err) {
        if (err) {
          console.log("Error writing DEV CSS file");
        }
        resolve(result.css);
      });
      return;
    }

    // write the dev CSS to the file system.
    if (isBuild && result.css) {
      fs.writeFile(BUILD_CSS_PATH + "/" + Math.round(Math.random() * 99999999) + ".css", result.css, function (err) {
        if (err) {
          console.log("Error writing BUILD CSS file");
        }
        resolve("");
      });
      return;
    }

    // This should only happen during build, in which case we let steal handle
    // bundling and compiling the CSS to /dist. We will concatenate and optimize these
    // files in another process - see Gruntfile.
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

// var sassProcessor = isNode ? "sass.js/dist/sass.sync" : "sass.js/dist/sass.worker";
var sassProcessor = isNode ? "node-sass" : "sass.js/dist/sass.worker";
var getSass = function (loader, newInstance) {
  // On initial page load in the browser, there is no need to instantiate the sass compiler
  if (!isNode && Object.keys(SASS_CACHE).length) {
    return Promise.resolve({});
  }

  return loader.normalize(sassProcessor, module.id).then(function(name){
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
      if (META.___using_sass) {
        sass = META.___using_sass;
      } else {
        sass = META.___using_sass = new Sass(url);
      }
    }
    return sass;
  });
};
