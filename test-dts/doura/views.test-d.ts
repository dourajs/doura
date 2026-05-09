import { defineModel, doura } from 'doura'
import { expectType } from '../helper'

const douraStore = doura()

interface depState {
  count: number
}

interface storeState {
  text: string
}

interface GrandChildState {
  value: number
}

interface ChildState {
  count: number
}

const depModel = defineModel({
  name: 'test',
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
  name: 'model',
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

const grandChild = defineModel({
  name: 'grandChild',
  state: {
    value: 1,
  },
  actions: {
    bump() {
      this.value++
    },
  },
  views: {
    grandDouble() {
      return this.value * 2
    },
  },
})

const child = defineModel({
  name: 'child',
  state: {
    count: 0,
  },
  models: [grandChild],
  actions: {
    someAction() {
      this.count++
    },
  },
  views: {
    double() {
      return this.count * 2
    },
  },
  queries: {
    someQuery() {
      return Promise.resolve(1)
    },
  },
})

defineModel({
  name: 'parentWithChildViews',
  state: {
    ready: true,
  },
  models: [child],
  actions: {
    actionAccess() {
      expectType<void>(this.child.someAction())
      expectType<Promise<number>>(this.child.someQuery.fetch())
      expectType<void>(this.child.$patch({ count: 1 }))
      expectType<void>(this.child.grandChild.bump())
    },
  },
  views: {
    childAccess() {
      expectType<number>(this.child.count)
      expectType<number>(this.child.double)
      expectType<ChildState>(this.child.$state)
      expectType<number>(this.child.$isolate((s) => s.count + 1))

      expectType<number>(this.child.grandChild.value)
      expectType<number>(this.child.grandChild.grandDouble)
      expectType<GrandChildState>(this.child.grandChild.$state)
      expectType<number>(this.child.grandChild.$isolate((s) => s.value + 1))

      // @ts-expect-error child actions are not visible inside views
      this.child.someAction()
      // @ts-expect-error child queries are not visible inside views
      this.child.someQuery
      // @ts-expect-error public mutation APIs are not visible inside views
      this.child.$patch({ count: 1 })
      // @ts-expect-error public action bag is not visible inside views
      this.child.$actions
      // @ts-expect-error public query bag is not visible inside views
      this.child.$queries
      // @ts-expect-error public subscription APIs are not visible inside views
      this.child.$subscribe
      // @ts-expect-error nested child actions are not visible inside views
      this.child.grandChild.bump()
    },
  },
})

const store = douraStore.getModel(model)
const depStore = douraStore.getModel(depModel)

expectType<void>(store.setText)
expectType<storeState>(store.$state)
expectType<number>(depStore.double)
expectType<depState>(depStore.$state)

defineModel({
  name: 'parameterizedView',
  state: {
    count: 1,
  },
  views: {
    // @ts-expect-error — parameterized views are not supported; return a closure instead.
    byMultiplier(_state, multiplier: number) {
      return multiplier
    },
  },
})
