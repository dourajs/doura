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
// Typed `this.someQuery` inside actions + name-narrowed $*Queries
// =============================================================
//
// Two type-level guarantees exercised below:
//  - `this.someQuery` resolves to a typed QueryHandle (not `any`), so
//    handle methods like .fetch() / .getData() carry TArgs / TData.
//  - `this.$invalidateQueries / $cancelQueries / $resetQueries /
//    $setQueryData / $getQueryData / $prefetchQuery` reject names that
//    aren't declared queries on this model.

/* eslint-disable @typescript-eslint/no-unused-vars */

export const modelWithQueries = defineModel({
  state: { count: 0 },
  actions: {
    async runBoth() {
      // `this.fetchData` should carry the full handle type — NOT any.
      // If it were any, the bogus method call would silently pass and
      // the ts-expect-error directive would be flagged as unused.
      // @ts-expect-error — fetchData is QueryHandle<void, number>, no .bogus()
      this.fetchData.bogus()

      const data = await this.fetchData.fetch()
      expectType<number>(data)

      // void-args query: getData returns TData | undefined
      expectType<number | undefined>(this.fetchData.getData())

      // Args query — args are required and typed.
      const user = await this.fetchUser.fetch({ id: '1' })
      expectType<{ id: string; name: string }>(user)

      // @ts-expect-error — fetchUser requires args
      this.fetchUser.fetch()

      // @ts-expect-error — data for fetchUser must be {id,name}, not a number
      this.fetchUser.setData({ id: '1' }, 42)
    },
  },
  queries: {
    fetchData: (_ctx: QueryCtx) => Promise.resolve(42),
    fetchUser: (_ctx: QueryCtx, args: { id: string }) =>
      Promise.resolve({ id: args.id, name: 'User ' + args.id }),
  },
})

export const modelWithInvalidation = defineModel({
  state: {},
  actions: {
    async mutate() {
      // Declared names type-check.
      this.$invalidateQueries('fetchX')
      this.$invalidateQueries('fetchY')
      this.$cancelQueries('fetchX')
      this.$resetQueries('fetchY')
      this.$setQueryData('fetchX', undefined, 'value')
      this.$getQueryData('fetchX')
      this.$prefetchQuery('fetchY')

      // Undeclared names are rejected.
      // @ts-expect-error — 'nonExistent' is not a declared query
      this.$invalidateQueries('nonExistent')
      // @ts-expect-error
      this.$cancelQueries('nonExistent')
      // @ts-expect-error
      this.$resetQueries('nonExistent')
      // @ts-expect-error
      this.$setQueryData('nonExistent', undefined, 0)
      // @ts-expect-error
      this.$getQueryData('nonExistent')
      // @ts-expect-error
      this.$prefetchQuery('nonExistent')

      // No-arg forms still work for the optional-name methods.
      this.$invalidateQueries()
      this.$cancelQueries()
      this.$resetQueries()
    },
  },
  queries: {
    fetchX: (_ctx: QueryCtx) => Promise.resolve('X'),
    fetchY: (_ctx: QueryCtx, args: { id: number }) => Promise.resolve(args.id),
  },
})

// Name-narrowing applies identically on ModelPublicInstance (external
// callers via store.getModel).
export function ExternalInvalidation() {
  const inst = douraStore.getModel('modelD', modelWithInvalidation)

  inst.$invalidateQueries('fetchX')
  inst.$setQueryData('fetchY', { id: 1 }, 0)

  // @ts-expect-error — external access enforces declared names too
  inst.$invalidateQueries('nope')
  // @ts-expect-error
  inst.$setQueryData('nope', undefined, 0)

  // Handle typing on the instance (regression guard).
  expectType<QueryHandle<void, string>>(inst.fetchX)
  expectType<QueryHandle<{ id: number }, number>>(inst.fetchY)
}

// A model with no queries falls back to `string` for $*Queries names so
// loose AnyModel consumers stay ergonomic.
export function LooseModelAcceptsAnyName() {
  const noQ = defineModel({
    state: { n: 0 },
    actions: {
      bump() {
        this.n++
      },
    },
  })
  const inst = douraStore.getModel('noQ', noQ)
  inst.$invalidateQueries('anything')
  inst.$invalidateQueries()
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
        // Own query via this — typed as QueryHandle<void, number>
        // @ts-expect-error — fetchData is QueryHandle, no .bogus()
        this.fetchData.bogus()

        const own = await this.fetchData.fetch()
        expectType<number>(own)
        expectType<number | undefined>(this.fetchData.getData())

        // Own query with args
        // @ts-expect-error — fetchUser requires args
        this.fetchUser.fetch()
        const user = await this.fetchUser.fetch({ id: '1' })
        expectType<{ id: string; name: string }>(user)

        // Composed child via closure — ModelPublicInstance<typeof child>
        const ch = await c.fetchChild.fetch()
        expectType<string>(ch)

        // $*Queries narrows to own declared names
        this.$invalidateQueries('fetchData')
        this.$invalidateQueries('fetchUser')
        // @ts-expect-error — 'nope' not declared
        this.$invalidateQueries('nope')
      },
    },
    queries: {
      fetchData: (_ctx: QueryCtx) => Promise.resolve(42),
      fetchUser: (_ctx: QueryCtx, args: { id: string }) =>
        Promise.resolve({ id: args.id, name: 'User ' + args.id }),
    },
  }
})
