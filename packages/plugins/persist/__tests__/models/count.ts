import { defineModel } from 'doura'
import { delay } from '../utils/delay'

export const count = defineModel({
  name: 'count',
  state: { value: 0 },
  actions: {
    add(payload: number = 1) {
      this.value += payload
    },
    async addAsync() {
      await delay(2)
      this.add(1)
    },
  },
})
