import { defineModel, doura, expectType } from './'

const douraStore = doura()

interface depState {
  count: number
}

interface storeState {
  text: string
}

const depModel = defineModel({
  name: 'depModel',
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
      expectType<{}>(this.$models)
    },
    viewParams(state) {
      expectType<{ count: number }>(state)
    },
  },
})

const model = defineModel({
  name: 'model',
  models: {
    depModel,
  },
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
      expectType<{ depModel: { $state: depState } & depState }>(this.$models)
      expectType<depState>(this.$models.depModel.$state)
      expectType<number>(this.$models.depModel.double)
      expectType<number>(this.$models.depModel.count)
      expectType<storeState>(this.$state)
      expectType<string>(this.text)
      expectType<void>(this.setText)
    },
  },
})

const store = douraStore.getModel(model)
const depStore = douraStore.getModel(depModel)

expectType<void>(store.setText)
expectType<storeState>(store.$state)
expectType<number>(depStore.double)
expectType<depState>(depStore.$state)
