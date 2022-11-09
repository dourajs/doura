import { defineModel } from 'doura'
import { delay } from './utils'

export const count = defineModel({
  name: 'count',
  state: { value: 0 },
  reducers: {
    increment: (state, payload: number) => {
      state.value += payload // change state by immer way
    },
  },
  actions: {
    async incrementAsync() {
      await delay(2)
      this.increment(1)
    },
  },
})
