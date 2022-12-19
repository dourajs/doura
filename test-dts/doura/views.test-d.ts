import { defineModel, doura } from 'doura'
import { expectType } from '../helper'

const douraStore = doura()

interface depState {
  count: number
}

interface storeState {
  text: string
}

const depModel = defineModel({
  state: {
    count: 0,
  },
  views: {
    isolate() {
      const r = this.$isolate((s) => ({ v: s.count + 1 }))
      return r
    },
    double() {
      return this.count * 2
    },
    increment() {
      expectType<number>(this.count)
      expectType<number>(this.double)
      expectType<number>(this.$isolate(() => 1))
    },
    viewParams(state) {
      expectType<{ count: number }>(state)
    },
  },
})

const model = defineModel({
  state: {
    text: 'initial',
  },
  actions: {
    reset() {
      this.text = 'initial'
    },
  },
  views: {
    setText() {
      expectType<storeState>(this.$state)
      expectType<string>(this.text)
      expectType<void>(this.setText)
    },
  },
})

const store = douraStore.getModel('model', model)
const depStore = douraStore.getModel('test', depModel)

expectType<void>(store.setText)
expectType<storeState>(store.$state)
expectType<number>(depStore.double)
expectType<depState>(depStore.$state)
