/* global Sass */
var css = require('$css')
var isNode = (typeof process === 'object' &&
  {}.toString.call(process) === '[object process]')
var getSass

exports.instantiate = css.instantiate
exports.buildType = 'css'

exports.translate = function (load) {
  var base = dir(load.address)
  var imports = getImports(load.source)
  var loader = this
  var sassLocation
  if (isNode) {
    // if we are on npm2 and we build your app with steal-tools, we are currently not in the
    // steal-sass directory.
    // we have to set the fully qualified path to the module
    sassLocation = __dirname + '/node_modules/' + 'sass.js/dist/sass.sync.js'

    try {
      // try to resolve the sass module on npm3
      sassLocation = loader._nodeRequire.resolve('sass.js/dist/sass.sync.js')
    } catch (e) {}

    getSass = Promise.resolve(loader._nodeRequire(sassLocation))
      .then((module) => module)
  } else {
    // require("sass.js/dist/sass")
    sassLocation = loader.normalize('sass.js/dist/sass.worker', 'steal-sass')
    getSass = Promise.resolve(sassLocation)
      .then((name) => loader.locate({ name: name }))
      .then((url) => new Sass(url))
      .then((sass) => preload(sass, base, imports))
  }

  getSass.then(function (sass) {
    return new Promise(function (resolve) {
      sass.compile(load.source, function (result) {
        resolve(result.text)
      })
    })
  })
}

function dir (path) {
  var parts = path.split('/')
  parts.pop()
  return parts.join('/')
}

function getImports (source) {
  var imports = []
  var importExp = /@import.+?"(.+?)"/g
  source.replace(importExp, function (whole, imp) {
    imports.push(imp)
  })
  return imports
}

function preload (sass, base, files) {
  if (!files.length) {
    return Promise.resolve(sass)
  }
  return new Promise((resolve) => {
    sass.preloadFiles(base, '', files, () => resolve(sass))
  })
}