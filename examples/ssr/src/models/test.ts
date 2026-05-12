import { defineModel } from 'doura'

export const test = defineModel({
  name: 'test',
  state: { value: '' },
  actions: {
    setString(payload: string) {
      this.value = payload
    },
  },
})
