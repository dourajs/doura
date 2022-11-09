import { defineModel } from 'doura'
import { delay } from './utils'

export const count = defineModel({
  name: 'count',
  state: { value: 0 },
  reducers: {
    add: (state, payload: number) => {
      state.value += payload // change state by immer way
    },
  },
  actions: {
    async addAsync() {
      await delay(2)
      this.add(1)
    },
  },
})
