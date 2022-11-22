import { defineModel, doura, expectType } from './'

const douraStore = doura()

interface State {
  count: number
}

const model = defineModel({
  name: 'model',
  state: {
    count: 0,
  },
  actions: {
    add(payload: number) {
      this.count += payload
    },
    accessibleThisValue() {
      expectType<State>(this.$state)
      expectType<void>(this.$patch({ count: 0 }))
      expectType<number>(this.returnValue())
      expectType<Promise<void>>(this.asyncAdd(1))
      expectType<number>(this.viewFunction)
      expectType<void>(this.add(1))
    },
    otherAction() {
      return this.returnValue()
    },
    returnValue(): number {
      this.otherAction()
      return this.$state.count
    },
    triggerReducer() {
      this.add(1)
    },
    async asyncAdd(payload: number): Promise<void> {
      await this.add(payload)
    },
  },
  views: {
    viewFunction() {
      return 1
    },
  },
})

const store = douraStore.getModel(model)

// props
expectType<State>(store.$state)

// views
expectType<number>(store.viewFunction)

// actions
expectType<number>(store.returnValue())
expectType<number>(store.otherAction())
expectType<void>(store.triggerReducer())
//@ts-expect-error
store.add()

// methods
store.$patch({ count: 0 })
//@ts-expect-error
store.$replace(BigInt(1))
//@ts-expect-error
store.$replace(Symbol(1))
