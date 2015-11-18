var assert = require("assert");
var stealTools = require("steal-tools");
var fs = require("fs");
var exists = function(pth){
  return fs.existsSync(pth);
};

describe("building", function(){
  this.timeout(20000);

  it("creates bundles", function(done){
    stealTools.build({
      config: __dirname + "/../package.json!npm",
      main: "test/main"
    }, {
      quiet: true,
      minify: false
    }).then(function(){
      assert(exists(__dirname + "/../dist/bundles/test/main.css"),
             "created the css bundle");
    }).then(done, done);
  });
});
