import { defineModel } from 'doura'
import { delay } from '../models/utils'

export const id = defineModel({
  name: 'id',
  state: { id: 0 },
  reducers: {
    increment: (_state, payload: number) => {
      return {
        id: payload,
      }
    },
  },
  actions: {
    async incrementAsync(id?: number) {
      await delay(500)
      this.increment(id || 1)
    },
  },
})
