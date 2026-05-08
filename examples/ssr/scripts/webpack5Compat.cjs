const Module = require('module')

const originalLoad = Module._load

function createIgnorePluginCompat(OriginalIgnorePlugin) {
  function IgnorePluginCompat(options, contextRegExp) {
    if (options instanceof RegExp) {
      return new OriginalIgnorePlugin({
        resourceRegExp: options,
        contextRegExp,
      })
    }

    return new OriginalIgnorePlugin(options)
  }

  Object.setPrototypeOf(IgnorePluginCompat, OriginalIgnorePlugin)
  IgnorePluginCompat.prototype = OriginalIgnorePlugin.prototype
  IgnorePluginCompat.__douraWebpack5Compat = true

  return IgnorePluginCompat
}

function sanitizeConfig(config) {
  if (Array.isArray(config)) {
    return config.map(sanitizeConfig)
  }

  if (!config || typeof config !== 'object') {
    return config
  }

  const node = config.node
  if (node && typeof node === 'object') {
    const { __dirname, __filename, global } = node
    config.node = { __dirname, __filename, global }

    for (const key of Object.keys(config.node)) {
      if (config.node[key] === undefined) {
        delete config.node[key]
      }
    }
  }

  if (Array.isArray(config.plugins)) {
    config.plugins = config.plugins.filter(
      (plugin) => plugin?.constructor?.name !== 'ForkTsCheckerWebpackPlugin'
    )
  }

  return config
}

function createWebpackCompat(webpack) {
  function webpackCompat(config, callback) {
    return webpack(sanitizeConfig(config), callback)
  }

  Object.defineProperties(webpackCompat, Object.getOwnPropertyDescriptors(webpack))
  webpackCompat.__douraWebpack5Compat = true

  return webpackCompat
}

Module._load = function load(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments)

  if (
    typeof loaded === 'function' &&
    loaded.version &&
    loaded.Compilation &&
    !loaded.__douraWebpack5Compat
  ) {
    return createWebpackCompat(loaded)
  }

  if (
    typeof loaded === 'function' &&
    loaded.name === 'IgnorePlugin' &&
    !loaded.__douraWebpack5Compat
  ) {
    return createIgnorePluginCompat(loaded)
  }

  return loaded
}
