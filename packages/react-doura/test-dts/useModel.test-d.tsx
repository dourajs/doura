import { defineModel, ModelData } from 'doura'
import { expectType, useModel, useRootModel } from './index'

type customType = 'custom' | 'custom0'

const count = defineModel({
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
      return this.s + ''
    },
  },
})

type countSelectorParameters = ModelData<typeof count>
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

function Test() {
  const [state, action] = useModel(count, countSelector)
  expectType<number>(state.n)
  expectType<number>(state.v)
  expectType<string>(state.s)
  expectType<string>(state.custom)
  expectType<void>(action.addValue())
  expectType<void>(action.setString('custom'))
  expectType<Promise<void>>(action.asyncAdd(0))

  const [rootState, rootAction] = useRootModel('count', count, countSelector)
  expectType<number>(rootState.n)
  expectType<number>(rootState.v)
  expectType<string>(rootState.s)
  expectType<string>(rootState.custom)
  expectType<void>(rootAction.addValue())
  expectType<void>(rootAction.setString('custom'))
  expectType<Promise<void>>(rootAction.asyncAdd(0))
}

function Test$State() {
  const [state] = useModel(count, count$State)
  expectType<number>(state.value)
  expectType<string>(state.s)

  const [rootState] = useRootModel('count', count, count$State)
  expectType<number>(rootState.value)
  expectType<string>(rootState.s)
}
