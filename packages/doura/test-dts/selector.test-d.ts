import { defineModel, ISelectorParams } from './'

type customType = 'custom' | 'custom0'

const count = defineModel({
  name: 'count',
  state: {
    value: 1,
    s: '',
  },
  reducers: {
    addValue(state, payload: number = 1) {
      return {
        ...state,
        value: state.value + payload,
      }
    },
    setString(state, payload: customType) {
      return {
        ...state,
        s: payload,
      }
    },
  },
  actions: {
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

type countSelectorParameters = ISelectorParams<typeof count>
const countSelector = function (stateAndViews: countSelectorParameters) {
  return {
    v: stateAndViews.value,
    n: stateAndViews.viewNumber,
    s: stateAndViews.viewString,
    custom: stateAndViews.viewString,
  }
}

const count$State = function (stateAndViews: countSelectorParameters) {
  return stateAndViews.$state
}
