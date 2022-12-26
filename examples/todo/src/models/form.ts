///<reference types="webpack-env" />
import { defineModel, acceptHMRUpdate } from 'doura'

export const inputModel = defineModel({
  state: {
    value: '',
  },
  actions: {
    update(event: React.ChangeEvent<HTMLInputElement>) {
      this.value = event.target.value
    },
    reset() {
      this.value = ''
    },
  },
})

// for model hmr
if (module.hot) {
  module.hot.accept()
  module.hot.dispose(acceptHMRUpdate(inputModel))
}
