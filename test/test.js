var F = require("funcunit");
var QUnit = require("steal-qunit");

F.attach(QUnit);

QUnit.module("steal-sass", {
  setup: function(){
    F.open("//demo.html");
  }
});

QUnit.test("basics works", function(){
  F("style").exists("the style was added to the page");
  F("style").size(1, "There should only be on style tag on the page");
});
