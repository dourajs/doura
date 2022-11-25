import { defineModel, ModelAPI } from 'doura'

export const sleep = (time: number) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, time)
  })

export const countModel = defineModel({
  state: {
    value: 1,
  },
  actions: {
    add(payload: number = 1) {
      this.value += payload
    },
    async asyncAdd(n: number) {
      await sleep(200)
      this.add(n)
    },
  },
  views: {
    test() {
      return this.value + 1
    },
  },
})

export type countSelectorParameters = ModelAPI<typeof countModel>
