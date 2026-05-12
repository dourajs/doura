import { defineModel } from 'doura'
import { delay } from '../utils/delay'

export const b = defineModel({
  name: 'b',
  state: { b: 0 },
  actions: {
    add(payload: number = 1) {
      this.b += payload
    },
    async addAsync() {
      await delay(2)
      this.add(1)
    },
  },
})
