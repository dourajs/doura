import { defineModel } from 'doura'
import { expectType, useAnonymousModel, useModel, Selector } from './index'

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
    viewExtra(s, n: number) {
      return s.value * n
    },
  },
})

const namedCount = defineModel({
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
      return this.s + ''
    },
    viewExtra(s, n: number) {
      return s.value * n
    },
  },
})

const functionCount = defineModel(() => ({
  state: {
    value: 1,
  },
}))

const countSelector: Selector<typeof count> = function (
  stateAndViews,
  actions
) {
  return {
    v: stateAndViews.value,
    n: stateAndViews.viewNumber,
    s: stateAndViews.viewString,
    e: stateAndViews.viewExtra(1),
    custom: stateAndViews.viewString,
    ...actions,
  }
}

function Test() {
  // @ts-expect-error — useModel(model) requires defineModel({ name, ... })
  useModel(count, countSelector)
  // @ts-expect-error — implicit name lookup is object-model only
  useModel(functionCount)

  const model = useAnonymousModel(count, countSelector)
  const anonymousFunctionModel = useAnonymousModel(functionCount)
  expectType<number>(anonymousFunctionModel.value)
  expectType<number>(model.n)
  expectType<number>(model.v)
  expectType<string>(model.s)
  expectType<string>(model.e)
  expectType<string>(model.custom)
  expectType<void>(model.addValue())
  expectType<void>(model.setString('custom'))
  expectType<Promise<void>>(model.asyncAdd(0))

  const implicitNamedModel = useModel(namedCount, countSelector)
  expectType<number>(implicitNamedModel.n)
  expectType<void>(implicitNamedModel.addValue())

  const namedModel = useModel('count', count, countSelector)
  expectType<number>(namedModel.n)
  expectType<number>(namedModel.v)
  expectType<string>(namedModel.s)
  expectType<string>(namedModel.custom)
  expectType<void>(namedModel.addValue())
  expectType<void>(namedModel.setString('custom'))
  expectType<Promise<void>>(namedModel.asyncAdd(0))
}
