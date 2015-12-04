var Sass = require ("$sass.js");
var css = require("$css");
var loader = require("@loader");
var isNode = typeof process === "object" && {}.toString.call(process) ===
    "[object process]";

exports.instantiate = css.instantiate;
exports.buildType = "css";

exports.translate = function(load){

  return getSass(this).then(function(sass){
    if(!isNode) {
      var base = dir(load.address).replace(/^https?:\/\/[^\/]+\/?/, "");

      sass.importer(function (req, done) {
        console.log("Checking", req, base);

        var fileName = req.resolved.replace(/^\/sass/, "");

        // if no extension, add underscore and extension
        if (!fileName.match(/\.scss$/)) {
          var parts = fileName.split('/');
          parts.push("_" + parts.pop() + ".scss");
          fileName = parts.join("/");
        }

        // remove leading slash
        fileName = fileName.replace(/^\//, "");

        // don't prepend files located in node_modules
        if (!fileName.match(/^node_modules/)) {
          fileName = base + "/" + fileName;
        }

        // Load file with text plugin
        fileName += "!text";

        //console.log("Importing", fileName);
        loader["import"](fileName).then(function (scss) {
          //console.log("Done importing", fileName);
          done({
            content: scss
          })
        })
      });

      return sass;
    }
    return sass;
  }).then(function(sass){
    return new Promise(function(resolve){
      console.log("compiling");
      sass.compile(load.source, function(result){
        console.log("compiled");
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
      getSass = function() { return Promise.resolve(sass); };
      return sass;
    });
  };
})();
