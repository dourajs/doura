import { defineModel, doura, QueryCtx, QueryFetch, QueryHandle } from 'doura'
import { expectType } from '../helper'

const douraStore = doura()

interface State {
  count: number
}

const model = defineModel({
  name: 'test',
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
      // can access view in actions
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
expectType<typeof store.add>(store.$actions.add)

// actions
expectType<number>(store.returnValue())
expectType<number>(store.otherAction())
expectType<void>(store.triggerReducer())
//@ts-expect-error require one params
store.add()

//@ts-expect-error non exist action
store.add1

// methods
store.$patch({ count: 0 })
//@ts-expect-error
store.$replace(BigInt(1))
//@ts-expect-error
store.$replace(Symbol(1))

// =============================================================
// Typed `this.someQuery` inside actions + model-wide $*Queries
// =============================================================
//
// Two type-level guarantees exercised below:
//  - `this.someQuery` resolves to a typed query fetch function (not `any`).
//  - single-query cache operations live on this.$queries.someQuery, while
//    $invalidateQueries / $cancelQueries / $resetQueries are model-wide only.

/* eslint-disable @typescript-eslint/no-unused-vars */

export const modelWithQueries = defineModel({
  name: 'modelWithQueries',
  state: { count: 0 },
  actions: {
    async runBoth() {
      // `this.fetchData` should carry the full fetch function type — NOT any.
      // If it were any, the bogus method call would silently pass and
      // the ts-expect-error directive would be flagged as unused.
      // @ts-expect-error — fetchData is QueryFetch<[], number>, no .bogus()
      this.fetchData.bogus()

      const data = await this.fetchData()
      expectType<number>(data)

      // void-args query: getData returns TData | undefined
      expectType<number | undefined>(this.$queries.fetchData.getData())

      // Args query — args are required and typed.
      const user = await this.fetchUser('1')
      expectType<{ id: string; name: string }>(user)

      // @ts-expect-error — fetchUser requires args
      this.fetchUser()

      // @ts-expect-error — data for fetchUser must be {id,name}, not a number
      this.$queries.fetchUser.setData('1', 42)
    },
  },
  queries: {
    fetchData: (_ctx: QueryCtx) => Promise.resolve(42),
    fetchUser: (_ctx: QueryCtx, id: string) =>
      Promise.resolve({ id, name: 'User ' + id }),
  },
})

export const modelWithInvalidation = defineModel({
  name: 'modelD',
  state: {},
  actions: {
    async mutate() {
      // Single-query operations use QueryHandle.
      this.$queries.fetchX.invalidate()
      this.$queries.fetchY.invalidate(1)
      this.$queries.fetchX.cancel()
      this.$queries.fetchY.reset(1)
      this.$queries.fetchX.setData('value')
      this.$queries.fetchX.getData()
      this.$queries.fetchY.prefetch(1)

      // No-arg model-wide forms still work.
      this.$invalidateQueries()
      this.$cancelQueries()
      this.$resetQueries()

      // Public instance batch methods no longer accept query names.
      // @ts-expect-error — use this.$queries.fetchX.invalidate()
      this.$invalidateQueries('fetchX')
      // @ts-expect-error — use this.$queries.fetchX.cancel()
      this.$cancelQueries('fetchX')
      // @ts-expect-error — use this.$queries.fetchY.reset()
      this.$resetQueries('fetchY')
      // @ts-expect-error — removed; use this.$queries.fetchX.setData(...)
      this.$setQueryData('fetchX', [], 'value')
      // @ts-expect-error — removed; use this.$queries.fetchX.getData()
      this.$getQueryData('fetchX')
      // @ts-expect-error — removed; use this.$queries.fetchY.prefetch(...)
      this.$prefetchQuery('fetchY', [1])
    },
  },
  queries: {
    fetchX: (_ctx: QueryCtx) => Promise.resolve('X'),
    fetchY: (_ctx: QueryCtx, id: number) => Promise.resolve(id),
  },
})

// Query API shape applies identically on ModelInstance (external
// callers via store.getModel).
export function ExternalInvalidation() {
  const inst = douraStore.getModel(modelWithInvalidation)

  inst.$invalidateQueries()
  inst.$queries.fetchY.setData(1, 0)

  // @ts-expect-error — public batch methods are model-wide only
  inst.$invalidateQueries('nope')
  // @ts-expect-error — removed from public instance API
  inst.$setQueryData('nope', [], 0)

  // Handle typing on the instance (regression guard).
  expectType<QueryFetch<[], string>>(inst.fetchX)
  expectType<QueryFetch<[number], number>>(inst.fetchY)
  expectType<QueryHandle<[], string>>(inst.$queries.fetchX)
  expectType<QueryHandle<[number], number>>(inst.$queries.fetchY)
}

// A model with no queries still exposes model-wide batch methods.
export function NoQueryModelHasBatchMethods() {
  const noQ = defineModel({
    name: 'noQ',
    state: { n: 0 },
    actions: {
      bump() {
        this.n++
      },
    },
  })
  const inst = douraStore.getModel(noQ)
  inst.$invalidateQueries()
  // @ts-expect-error — public batch methods are model-wide only
  inst.$invalidateQueries('anything')
}

// =============================================================
// models variant — same guarantees as local query handles.
// =============================================================
//
// A model can compose child models via `models` AND declare its own queries.
// Both paths must be typed correctly:
//  - own queries via `this.xxQuery` (same handle-on-this threading)
//  - composed children via `this.childName`

const child = defineModel({
  name: 'child',
  state: {},
  queries: {
    fetchChild: (_ctx: QueryCtx) => Promise.resolve('child'),
  },
})

export const modelWithOwnQueriesAndChildren = defineModel({
  name: 'modelWithOwnQueriesAndChildren',
  state: { count: 0 },
  models: [child],
  actions: {
    async refresh() {
      // Own query via this — typed as QueryFetch<[], number>
      // @ts-expect-error — fetchData is QueryFetch, no .bogus()
      this.fetchData.bogus()

      const own = await this.fetchData()
      expectType<number>(own)
      expectType<number | undefined>(this.$queries.fetchData.getData())

      // Own query with args
      // @ts-expect-error — fetchUser requires args
      this.fetchUser()
      const user = await this.fetchUser('1')
      expectType<{ id: string; name: string }>(user)

      // Composed child via this — ModelInstance<typeof child>
      const ch = await this.child.fetchChild()
      expectType<string>(ch)

      // Query handles own single-query operations.
      this.$queries.fetchData.invalidate()
      this.$queries.fetchUser.invalidate('1')
      // @ts-expect-error — public batch methods are model-wide only
      this.$invalidateQueries('fetchData')
    },
  },
  queries: {
    fetchData: (_ctx: QueryCtx) => Promise.resolve(42),
    fetchUser: (_ctx: QueryCtx, id: string) =>
      Promise.resolve({ id, name: 'User ' + id }),
  },
})
