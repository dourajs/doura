import { defineModel } from 'doura'
import { delay } from './utils'

export const a = defineModel({
  name: 'a',
  state: { a: 0 },
  reducers: {
    add: (state, payload: number = 1) => {
      state.a += payload
    },
  },
  actions: {
    async addAsync() {
      await delay(2)
      this.add(1)
    },
  },
})
