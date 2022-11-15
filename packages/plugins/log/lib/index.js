'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const douraLog = function () {
  return {
    onModelInstance(instance) {
      instance.$onAction((action) => {
        console.log('action: ', action)
        console.log('$state :', instance.$rawState)
      })
    },
  }
}
exports.default = douraLog
