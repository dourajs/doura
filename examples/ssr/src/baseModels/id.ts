import { defineModel } from 'doura'
import { delay } from '../models/utils'

export const id = defineModel({
  name: 'id',
  state: { id: 0 },
  actions: {
    increment(payload: number) {
      this.id = payload
    },
    async incrementAsync(id?: number) {
      await delay(500)
      this.increment(id || 1)
    },
  },
})
