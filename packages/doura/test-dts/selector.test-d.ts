import { defineModel, Selector } from './'

type customType = 'custom' | 'custom0'

const count = defineModel({
  name: 'count',
  state: {
    value: 1,
    s: '',
  },
  actions: {
    addValue(payload: number = 1) {
      this.value += payload
    },
    setString(payload: customType) {
      this.s = payload
    },
    async asyncAdd(arg0: number) {
      this.addValue(arg0)
    },
    async asyncStr(arg0: number, arg1?: customType) {
      if (arg1) {
        this.addValue(arg0)
      }
    },
  },
  views: {
    viewNumber() {
      return this.value
    },
    viewString() {
      return this.s
    },
  },
})

type CountSelector = Selector<typeof count>
const countSelector: CountSelector = function (stateAndViews) {
  return {
    v: stateAndViews.value,
    n: stateAndViews.viewNumber,
    s: stateAndViews.viewString,
    custom: stateAndViews.viewString,
  }
}

const count$State: CountSelector = function (stateAndViews) {
  return stateAndViews.$state
}
