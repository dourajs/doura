import { defineModel } from 'doura'
import { delay } from '../utils/delay'

export const a = defineModel({
  name: 'a',
  state: { a: 0 },
  actions: {
    add(payload: number = 1) {
      this.a += payload
    },
    async addAsync() {
      await delay(2)
      this.add(1)
    },
  },
})
