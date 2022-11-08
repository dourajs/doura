import { defineModel, expectType, Action } from './'

const depend0 = defineModel({
  state: {
    d0: 0,
  },
  reducers: {
    reducerD0(state) {
      state.d0 += 1
    },
  },
  actions: {
    actionD0() {
      return this.$state.d0
    },
  },
  views: {
    viewD0() {
      return this.$state.d0
    },
  },
})

const depend1 = defineModel({
  state: {
    d1: '0',
  },
  reducers: {
    reducerD1(state) {
      state.d1 += 1
    },
  },
  actions: {
    actionD1() {
      return this.$state.d1
    },
  },
  views: {
    viewD1() {
      return this.$state.d1
    },
  },
})

const modelHasDep = defineModel(
  {
    state: {
      count: 0,
    },
    actions: {
      accessDepend() {
        expectType<number>(this.$dep[0].$state.d0)
        expectType<Action<void>>(this.$dep[0].reducerD0())
        expectType<number>(this.$dep[0].actionD0())
        expectType<number>(this.$dep[0].viewD0)

        expectType<string>(this.$dep[1].$state.d1)
        expectType<Action<void>>(this.$dep[1].reducerD1())
        expectType<string>(this.$dep[1].actionD1())
        expectType<string>(this.$dep[1].viewD1)
      },
    },
  },
  [depend0, depend1]
)

const foo = defineModel({
  name: 'foo',
  state: {
    count: 0,
  },
})

const bar = defineModel(
  {
    name: 'bar',
    state: {
      count: 0,
    },
    actions: {
      accessDepend() {
        expectType<number>(this.$dep.foo.$state.count)
      },
    },
  },
  [foo]
)
