import { defineModel, expectType } from './'

const depend0 = defineModel({
  state: {
    d0: 0,
  },
  actions: {
    actionD0() {
      this.$state.d0 += 1
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
  actions: {
    actionD1() {
      this.$state.d1 += 1
    },
  },
  views: {
    viewD1() {
      return this.$state.d1
    },
  },
})

const modelHasDep = defineModel({
  state: {
    count: 0,
  },
  models: {
    depend0,
    depend1,
  },
  actions: {
    accessDepend() {
      expectType<number>(this.$models.depend0.$state.d0)
      expectType<void>(this.$models.depend0.actionD0())
      expectType<number>(this.$models.depend0.viewD0)

      expectType<string>(this.$models.depend1.$state.d1)
      expectType<void>(this.$models.depend1.actionD1())
      expectType<string>(this.$models.depend1.viewD1)
    },
  },
})

const foo = defineModel({
  state: {
    count: 0,
  },
})

const bar = defineModel({
  name: 'bar',
  models: {
    foo,
  },
  state: {
    count: 0,
  },
  actions: {
    accessDepend() {
      expectType<number>(this.$models.foo.$state.count)
    },
  },
})
