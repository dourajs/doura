import type { Plugin } from 'doura'

const douraLog: Plugin = () => ({
  onModelInstance(instance) {
    instance.$onAction((action) => {
      console.log('action: ', action)
      console.log('$state :', instance.$rawState)
    })
  },
})

export default douraLog
