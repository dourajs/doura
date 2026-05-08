import {
  defineModel,
  doura,
  query,
  use,
  QueryCtx,
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
      this.fetchUser.invalidate()
      this.fetchUser.invalidate(payload.id)
      this.fetchUser.cancel(payload.id)
      this.fetchUser.reset(payload.id)
      this.$invalidateQueries()
      this.$cancelQueries()
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
    fetchUser: (ctx, id: string) => {
      expectType<QueryCtx>(ctx)
      return Promise.resolve({ id, name: 'User' })
    },

    // full spec — only fn/staleTime are supported.
    fetchUserToState: {
      fn(ctx, id: string) {
        expectType<QueryCtx>(ctx)
        expectType<Record<string, User>>(this.users)
        const user = { id, name: 'User' }
        this.users[id] = user
        return Promise.resolve(user)
      },
      staleTime: 5000,
    },
  },
})

// --- Model instance with queries ---

const store = doura()
const inst = store.getModel('user', userModel)

// $queries has full type inference
expectType<ModelQueries<typeof userModel>>(inst.$queries)

// queries accessible via $queries resolve to QueryHandle handles
expectType<QueryHandle<[], { id: string; name: string }[]>>(
  inst.$queries.fetchList
)
expectType<QueryHandle<[string], { id: string; name: string }>>(
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
expectType<Promise<void>>(inst.$queries.fetchList.prefetch())
inst.$queries.fetchList.invalidate()
inst.$queries.fetchList.cancel()
inst.$queries.fetchList.reset()
inst.$queries.fetchList.setData([{ id: '1', name: 'Alice' }])
// @ts-expect-error — no-args query handle does not accept args
inst.$queries.fetchList.cancel('1')

// args query
expectType<{ id: string; name: string } | undefined>(
  inst.$queries.fetchUser.getData('1')
)
expectType<boolean>(inst.$queries.fetchUser.isFetching('1'))
expectType<Promise<void>>(inst.$queries.fetchUser.prefetch('1'))
inst.$queries.fetchUser.cancel('1')
inst.$queries.fetchUser.cancel()
inst.$queries.fetchUser.setData('1', { id: '1', name: 'Alice' })

// @ts-expect-error — missing args
inst.$queries.fetchUser.getData()
// @ts-expect-error — prefetch requires query args
inst.$queries.fetchUser.prefetch()

// --- Public query methods on model instance ---

// model-wide batch methods
inst.$invalidateQueries()
inst.$cancelQueries()
inst.$resetQueries()

// @ts-expect-error — single-query invalidation moved to QueryHandle.invalidate()
inst.$invalidateQueries('fetchUser')
// @ts-expect-error — single-query cancellation moved to QueryHandle.cancel()
inst.$cancelQueries('fetchUser')
// @ts-expect-error — single-query reset moved to QueryHandle.reset()
inst.$resetQueries('fetchUser')
// @ts-expect-error — removed; use inst.$queries.fetchUser.setData(...)
inst.$setQueryData('fetchUser', ['1'], { id: '1', name: 'Alice' })
// @ts-expect-error — removed; use inst.$queries.fetchUser.getData(...)
inst.$getQueryData('fetchUser', ['1'])
// @ts-expect-error — removed; use inst.$queries.fetchUser.prefetch(...)
inst.$prefetchQuery('fetchUser', ['1'])

// --- Cross-model invalidation via use() ---

const composedModel = defineModel(() => {
  const users = use('users', userModel)

  return {
    state: {},
    actions: {
      invalidateUsers() {
        users.fetchUser.invalidate()
        users.fetchUser.setData('1', { id: '1', name: 'Bob' })
        users.$cancelQueries()
        users.fetchUser.reset()
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
    fetchThing: (_ctx, id: string) => Promise.resolve({ id, value: 1 }),
  },
})

const inferredInst = store.getModel('inferred', inferredModel)
expectType<QueryHandle<[], number>>(inferredInst.fetchCount)
expectType<QueryHandle<[string], { id: string; value: number }>>(
  inferredInst.fetchThing
)

// =============================================================
// query() helper — fn-driven inner inference
// =============================================================
//
// Inside `query(...)` TS establishes a fresh inference context: `fn`
// is the sole authoritative position for TArgs / TData.
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
    // No-args form.
    fetchListHelper: query({
      fn: (ctx): Promise<User[]> => {
        expectType<QueryCtx>(ctx)
        return Promise.resolve([{ id: '1', name: 'Alice' }])
      },
      staleTime: 5000,
    }),

    // Args form — tuple args are declared directly inside fn.
    fetchUserHelper: query({
      fn: (ctx, id: string) => {
        expectType<QueryCtx>(ctx)
        expectType<string>(id)
        return Promise.resolve({ id, name: 'User ' + id })
      },
    }),

    objectArgHelper: query({
      fn: (ctx, args: { id: string }) => {
        expectType<QueryCtx>(ctx)
        expectType<{ id: string }>(args)
        return Promise.resolve({ id: args.id, name: 'User ' + args.id })
      },
    }),
    removedKey: query({
      fn: (_ctx) => Promise.resolve(1),
      // @ts-expect-error — removed from query specs; cache identity comes from args
      key: () => ['x'],
    }),
    removedOnData: query({
      fn: (_ctx) => Promise.resolve(1),
      // @ts-expect-error — removed from query specs; write state inside fn
      onData: () => undefined,
    }),
    removedSetData: query({
      fn: (_ctx) => Promise.resolve(1),
      // @ts-expect-error — removed from query specs; write state inside fn
      setData: (_state: InferredState, _data: number) => undefined,
    }),
    removedGetData: query({
      fn: (_ctx) => Promise.resolve(1),
      // @ts-expect-error — removed from query specs; reads come from cache
      getData: (_state: InferredState) => 1,
    }),
  },
})
