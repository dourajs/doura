import { defineModel, doura, QueryCtx, QueryHandle } from 'doura'
import { expectType } from '../helper'

const douraStore = doura()

interface State {
  count: number
}

const model = defineModel({
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

const store = douraStore.getModel('test', model)

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
//  - `this.someQuery` resolves to a typed QueryHandle (not `any`), so
//    handle methods like .fetch() / .getData() carry TArgs / TData.
//  - single-query cache operations live on QueryHandle, while
//    $invalidateQueries / $cancelQueries / $resetQueries are model-wide only.

/* eslint-disable @typescript-eslint/no-unused-vars */

export const modelWithQueries = defineModel({
  state: { count: 0 },
  actions: {
    async runBoth() {
      // `this.fetchData` should carry the full handle type — NOT any.
      // If it were any, the bogus method call would silently pass and
      // the ts-expect-error directive would be flagged as unused.
      // @ts-expect-error — fetchData is QueryHandle<[], number>, no .bogus()
      this.fetchData.bogus()

      const data = await this.fetchData.fetch()
      expectType<number>(data)

      // void-args query: getData returns TData | undefined
      expectType<number | undefined>(this.fetchData.getData())

      // Args query — args are required and typed.
      const user = await this.fetchUser.fetch('1')
      expectType<{ id: string; name: string }>(user)

      // @ts-expect-error — fetchUser requires args
      this.fetchUser.fetch()

      // @ts-expect-error — data for fetchUser must be {id,name}, not a number
      this.fetchUser.setData('1', 42)
    },
  },
  queries: {
    fetchData: (_ctx: QueryCtx) => Promise.resolve(42),
    fetchUser: (_ctx: QueryCtx, id: string) =>
      Promise.resolve({ id, name: 'User ' + id }),
  },
})

export const modelWithInvalidation = defineModel({
  state: {},
  actions: {
    async mutate() {
      // Single-query operations use QueryHandle.
      this.fetchX.invalidate()
      this.fetchY.invalidate(1)
      this.fetchX.cancel()
      this.fetchY.reset(1)
      this.fetchX.setData('value')
      this.fetchX.getData()
      this.fetchY.prefetch(1)

      // No-arg model-wide forms still work.
      this.$invalidateQueries()
      this.$cancelQueries()
      this.$resetQueries()

      // Public instance batch methods no longer accept query names.
      // @ts-expect-error — use this.fetchX.invalidate()
      this.$invalidateQueries('fetchX')
      // @ts-expect-error — use this.fetchX.cancel()
      this.$cancelQueries('fetchX')
      // @ts-expect-error — use this.fetchY.reset()
      this.$resetQueries('fetchY')
      // @ts-expect-error — removed; use this.fetchX.setData(...)
      this.$setQueryData('fetchX', [], 'value')
      // @ts-expect-error — removed; use this.fetchX.getData()
      this.$getQueryData('fetchX')
      // @ts-expect-error — removed; use this.fetchY.prefetch(...)
      this.$prefetchQuery('fetchY', [1])
    },
  },
  queries: {
    fetchX: (_ctx: QueryCtx) => Promise.resolve('X'),
    fetchY: (_ctx: QueryCtx, id: number) => Promise.resolve(id),
  },
})

// Query API shape applies identically on ModelPublicInstance (external
// callers via store.getModel).
export function ExternalInvalidation() {
  const inst = douraStore.getModel('modelD', modelWithInvalidation)

  inst.$invalidateQueries()
  inst.fetchY.setData(1, 0)

  // @ts-expect-error — public batch methods are model-wide only
  inst.$invalidateQueries('nope')
  // @ts-expect-error — removed from public instance API
  inst.$setQueryData('nope', [], 0)

  // Handle typing on the instance (regression guard).
  expectType<QueryHandle<[], string>>(inst.fetchX)
  expectType<QueryHandle<[number], number>>(inst.fetchY)
}

// A model with no queries still exposes model-wide batch methods.
export function NoQueryModelHasBatchMethods() {
  const noQ = defineModel({
    state: { n: 0 },
    actions: {
      bump() {
        this.n++
      },
    },
  })
  const inst = douraStore.getModel('noQ', noQ)
  inst.$invalidateQueries()
  // @ts-expect-error — public batch methods are model-wide only
  inst.$invalidateQueries('anything')
}

// =============================================================
// Function model variant — same guarantees as object model.
// =============================================================
//
// A function model commonly composes child models via use() AND declares
// its own queries. Both paths must be typed correctly:
//  - own queries via `this.xxQuery` (same handle-on-this threading)
//  - composed children via closure refs returned from use()

import { use } from 'doura'

const child = defineModel({
  state: {},
  queries: {
    fetchChild: (_ctx: QueryCtx) => Promise.resolve('child'),
  },
})

export const functionModelWithOwnQueries = defineModel(() => {
  const c = use('child', child)

  return {
    state: { count: 0 },
    actions: {
      async refresh() {
        // Own query via this — typed as QueryHandle<[], number>
        // @ts-expect-error — fetchData is QueryHandle, no .bogus()
        this.fetchData.bogus()

        const own = await this.fetchData.fetch()
        expectType<number>(own)
        expectType<number | undefined>(this.fetchData.getData())

        // Own query with args
        // @ts-expect-error — fetchUser requires args
        this.fetchUser.fetch()
        const user = await this.fetchUser.fetch('1')
        expectType<{ id: string; name: string }>(user)

        // Composed child via closure — ModelPublicInstance<typeof child>
        const ch = await c.fetchChild.fetch()
        expectType<string>(ch)

        // Query handles own single-query operations.
        this.fetchData.invalidate()
        this.fetchUser.invalidate('1')
        // @ts-expect-error — public batch methods are model-wide only
        this.$invalidateQueries('fetchData')
      },
    },
    queries: {
      fetchData: (_ctx: QueryCtx) => Promise.resolve(42),
      fetchUser: (_ctx: QueryCtx, id: string) =>
        Promise.resolve({ id, name: 'User ' + id }),
    },
  }
})
