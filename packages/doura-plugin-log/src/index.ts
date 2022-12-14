import { Plugin } from 'doura'

const douraLog: Plugin = function () {
  return {
    onModelInstance(instance) {
      instance.$onAction((action) => {
        console.log('action: ', action)
        console.log('$state :', instance.$rawState)
      })
    },
  }
}

export default douraLog
