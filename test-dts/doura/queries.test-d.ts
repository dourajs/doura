import {
  defineModel,
  doura,
  query,
  use,
  QueryCtx,
  OnDataCtx,
  ModelQueries,
  QueryHandle,
} from 'doura'
import { expectType } from '../helper'

// --- defineModel with queries ---

interface User {
  id: string
  name: string
}

const userModel = defineModel({
  state: {
    users: {} as Record<string, User>,
  },
  actions: {
    async updateUser(payload: { id: string; name: string }) {
      this.users[payload.id] = payload
      // query methods accessible from actions via this
      this.$invalidateQueries('fetchUser')
      this.$invalidateQueries('fetchUser', { id: payload.id })
      this.$invalidateQueries()
      this.$cancelQueries('fetchUser')
      this.$cancelQueries()
      this.$resetQueries('fetchUser', { id: '1' })
      this.$resetQueries()
    },
  },
  queries: {
    // shorthand — bare function, no args (ctx should auto-infer as QueryCtx)
    fetchList: (ctx) => {
      expectType<QueryCtx>(ctx)
      return Promise.resolve([{ id: '1', name: 'Alice' }])
    },

    // shorthand — bare function, with args (ctx should auto-infer as QueryCtx)
    fetchUser: (ctx, args: { id: string }) => {
      expectType<QueryCtx>(ctx)
      return Promise.resolve({ id: args.id, name: 'User' })
    },

    // full spec — bare object literal. TS contextual-types inner
    // callbacks against `QuerySpec<any, any, S>` from QueriesOption,
    // so args/data on key/onData DON'T flow from fn here; users have
    // to re-annotate them unless they opt into `query(...)`. `const Q`
    // + the self-referential mapped-type constraint on defineModel
    // keep the literal shape narrow for DOWNSTREAM uses (ModelQueries,
    // handles) but can't alter inner contextual typing.
    fetchUserToState: {
      key: (args: { id: string }) => [args.id],
      fn: (ctx, args: { id: string }) => {
        expectType<QueryCtx>(ctx)
        return Promise.resolve({ id: args.id, name: 'User' })
      },
      staleTime: 5000,
      onData: (
        ctx: OnDataCtx<{ users: Record<string, User> }, { id: string }>,
        data: User
      ) => {
        ctx.state.users[ctx.args.id] = data
      },
    },
  },
})

// --- Model instance with queries ---

const store = doura()
const inst = store.getModel('user', userModel)

// $queries has full type inference
expectType<ModelQueries<typeof userModel>>(inst.$queries)

// queries accessible via $queries resolve to QueryHandle handles
expectType<QueryHandle<void, { id: string; name: string }[]>>(
  inst.$queries.fetchList
)
expectType<QueryHandle<{ id: string }, { id: string; name: string }>>(
  inst.$queries.fetchUser
)

// @ts-expect-error — non-existent query name is a type error
inst.$queries.nonExistent

// queries also accessible directly on the instance (like actions)
// @ts-expect-error — non-existent property is a type error
inst.nonExistentQuery

// --- QueryHandle runtime methods on handles ---

// no-args query
expectType<{ id: string; name: string }[] | undefined>(
  inst.$queries.fetchList.getData()
)
expectType<boolean>(inst.$queries.fetchList.isFetching())
expectType<boolean>(inst.$queries.fetchList.isStale())
expectType<Promise<{ id: string; name: string }[]>>(
  inst.$queries.fetchList.fetch()
)
inst.$queries.fetchList.invalidate()
inst.$queries.fetchList.reset()
inst.$queries.fetchList.setData([{ id: '1', name: 'Alice' }])

// args query
expectType<{ id: string; name: string } | undefined>(
  inst.$queries.fetchUser.getData({ id: '1' })
)
expectType<boolean>(inst.$queries.fetchUser.isFetching({ id: '1' }))
inst.$queries.fetchUser.setData({ id: '1' }, { id: '1', name: 'Alice' })

// @ts-expect-error — missing args
inst.$queries.fetchUser.getData()

// --- Public query methods on model instance ---

// $invalidateQueries
inst.$invalidateQueries()
inst.$invalidateQueries('fetchUser')
inst.$invalidateQueries('fetchUser', { id: '1' })

// $setQueryData / $getQueryData
inst.$setQueryData('fetchUser', { id: '1' }, { id: '1', name: 'Alice' })
expectType<unknown | undefined>(inst.$getQueryData('fetchUser', { id: '1' }))

// $prefetchQuery
expectType<Promise<void>>(inst.$prefetchQuery('fetchUser', { id: '1' }))

// $cancelQueries
inst.$cancelQueries()
inst.$cancelQueries('fetchUser')
inst.$cancelQueries('fetchUser', { id: '1' })

// $resetQueries
inst.$resetQueries()
inst.$resetQueries('fetchUser')
inst.$resetQueries('fetchUser', { id: '1' })

// --- Cross-model invalidation via use() ---

const composedModel = defineModel(() => {
  const users = use('users', userModel)

  return {
    state: {},
    actions: {
      invalidateUsers() {
        users.$invalidateQueries('fetchUser')
        users.$setQueryData('fetchUser', { id: '1' }, { id: '1', name: 'Bob' })
        users.$cancelQueries()
        users.$resetQueries('fetchUser')
      },
    },
  }
})

// --- defineModel with queries alongside actions and views ---

const fullModel = defineModel({
  state: {
    count: 0,
  },
  actions: {
    increment() {
      this.count += 1
      // $invalidateQueries accessible from action this context
      this.$invalidateQueries()
    },
  },
  views: {
    double() {
      return this.count * 2
    },
  },
  queries: {
    fetchCount: (ctx) => {
      expectType<QueryCtx>(ctx)
      return Promise.resolve(42)
    },
  },
})

const fullInst = store.getModel('full', fullModel)
expectType<number>(fullInst.count)
expectType<number>(fullInst.double)
expectType<void>(fullInst.increment())
expectType<ModelQueries<typeof fullModel>>(fullInst.$queries)

// Use composedModel to prevent unused error
store.getModel('composed', composedModel)

// =============================================================
// Downstream handle typing — fn signatures reach ModelQueries
// =============================================================
//
// `const Q` + InferQueryEntry on defineModel captures each entry's
// literal fn signature, so downstream `ModelQueries<typeof model>` /
// handle typing extracts TArgs/TData correctly.

const inferredModel = defineModel({
  state: { count: 0 },
  queries: {
    fetchCount: (_ctx) => Promise.resolve(42),
    fetchThing: (_ctx, args: { id: string }) =>
      Promise.resolve({ id: args.id, value: 1 }),
  },
})

const inferredInst = store.getModel('inferred', inferredModel)
expectType<QueryHandle<void, number>>(inferredInst.fetchCount)
expectType<QueryHandle<{ id: string }, { id: string; value: number }>>(
  inferredInst.fetchThing
)

// =============================================================
// query() helper — fn-driven inner inference
// =============================================================
//
// Inside `query(...)` TS establishes a fresh inference context: `fn`
// is the sole authoritative position for TArgs / TData, and NoInfer
// wrapping on key / onData lets them receive those
// inferred types via contextual typing. No generics at the call site,
// no per-callback annotation.
//
// Why the helper is needed (even on TS 5.4): inside defineModel the
// queries field is typed against QueriesOption<S>, and its
// QuerySpec<any,any,S> member collapses NoInfer to `any` for bare
// literal entries. query() creates a per-entry context where TArgs /
// TData actually flow from fn first.

interface InferredState {
  users: Record<string, User>
}

defineModel({
  state: { users: {} as Record<string, User> } as InferredState,
  queries: {
    // No-args form — TData from fn flows into onData.
    fetchListHelper: query({
      fn: (ctx): Promise<User[]> => {
        expectType<QueryCtx>(ctx)
        return Promise.resolve([{ id: '1', name: 'Alice' }])
      },
      key: () => ['users'],
      onData: (ctx, data) => {
        expectType<OnDataCtx<InferredState, void>>(ctx)
        expectType<User[]>(data)
        expectType<void>(ctx.args)
        ctx.state.users = Object.fromEntries(
          data.map((u: User) => [u.id, u] as const)
        )
      },
      staleTime: 5000,
    }),

    // Args form — `args: { id: string }` declared ONCE inside fn.
    // key / onData receive `args` / `data` contextually
    // typed without any further annotation.
    fetchUserHelper: query({
      fn: (ctx, args: { id: string }) => {
        expectType<QueryCtx>(ctx)
        expectType<{ id: string }>(args)
        return Promise.resolve({ id: args.id, name: 'User ' + args.id })
      },
      key: (args) => {
        expectType<{ id: string }>(args)
        return [args.id]
      },
      onData: (ctx, data) => {
        expectType<OnDataCtx<InferredState, { id: string }>>(ctx)
        expectType<{ id: string; name: string }>(data)
        expectType<{ id: string }>(ctx.args)
        ctx.state.users[ctx.args.id] = data
      },
    }),

    // Negative guard — NoInfer on non-fn callbacks means wrong
    // annotations don't silently redefine TArgs / TData; they must
    // surface as assignability errors.
    badArgsGuard: query({
      fn: (_ctx, args: { id: string }) => Promise.resolve(args.id),
      // @ts-expect-error — args must be {id:string} (from fn)
      key: (args: { name: string }) => [args.name],
    }),
    badOnDataGuard: query({
      fn: (_ctx, args: { id: string }) => Promise.resolve(args.id),
      // @ts-expect-error — ctx.args must be {id:string} (from fn)
      onData: (ctx: OnDataCtx<InferredState, { name: string }>, data) => {
        expectType<string>(data)
        void ctx.args.name
      },
    }),
    removedSetData: query({
      fn: (_ctx) => Promise.resolve(1),
      // @ts-expect-error — removed from query specs; use onData
      setData: (_state: InferredState, _data: number) => undefined,
    }),
    removedGetData: query({
      fn: (_ctx) => Promise.resolve(1),
      // @ts-expect-error — removed from query specs; reads come from cache
      getData: (_state: InferredState) => 1,
    }),
  },
})
