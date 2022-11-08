import { defineModel, doura, expectType, Action } from './'

const douraStore = doura()

const model = defineModel({
  name: 'model',
  state: {
    text: 'A',
    number: 10,
  },
  reducers: {
    testReducer(state) {
      expectType<{ text: string; number: number }>(state)
      expectType<string>(state.text)
      expectType<number>(state.number)
      //@ts-expect-error
      state.number = true
      //@ts-expect-error
      state.text = []
    },
  },
})

const store = douraStore.getModel(model)

expectType<{ text: string; number: number }>(store.$state)

const dispatched = store.testReducer()
expectType<Action>(dispatched)
