'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/doura.cjs.prod.js')
} else {
  module.exports = require('./dist/doura.cjs.js')
}
