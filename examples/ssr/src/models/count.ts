import { defineModel } from 'doura'
import { delay } from './utils'

export const count = defineModel({
  name: 'count',
  state: { value: 0 },
  actions: {
    increment(payload: number) {
      this.value += payload
    },
    async incrementAsync() {
      await delay(2)
      this.increment(1)
    },
  },
})
