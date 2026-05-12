import { defineModel, QueryFetch, QueryCtx } from 'doura'
import { useDetachedModel, useModel, useQuery } from 'react-doura'
import { expectType } from '../helper'

interface User {
  id: string
  name: string
}

const userModel = defineModel({
  name: 'user',
  state: {
    // Keep state literal-shaped — a Record<string, ...> in state would
    // introduce an index signature that widens ModelAPI enough for
    // arbitrary property access to type-check.
    count: 0,
  },
  actions: {
    bump() {
      /* marker action */
    },
  },
  queries: {
    // void-args query
    fetchList: (ctx) => {
      expectType<QueryCtx>(ctx)
      return Promise.resolve<User[]>([{ id: '1', name: 'Alice' }])
    },
    // args query (shorthand fn)
    fetchUser: (ctx, id: string) => {
      expectType<QueryCtx>(ctx)
      return Promise.resolve<User>({ id, name: 'User ' + id })
    },
    // args query with shorthand function
    fetchUserSpec: (ctx, id: string) => {
      expectType<QueryCtx>(ctx)
      return Promise.resolve<User>({ id, name: 'Spec ' + id })
    },
  },
})

export function TestUseModelQueryTypes() {
  // Named model — the returned api is the merged ModelAPI which includes
  // direct query fetches alongside state/views/actions.
  const api = useModel(userModel)

  // --- Direct query fetch functions surface with full inference, not `any` ---

  expectType<QueryFetch<[], User[]>>(api.fetchList)
  expectType<QueryFetch<[string], User>>(api.fetchUser)
  expectType<QueryFetch<[string], User>>(api.fetchUserSpec)

  // Query handles are not exposed on ModelAPI snapshots returned by useModel.
  // Use direct query fetches with useQuery, or use a ModelInstance for
  // command-style cache handle operations.
  // @ts-expect-error — ModelAPI does not expose query handles
  api.$queries

  // --- Runtime methods carry the inferred TArgs / TData ---

  // void-args: direct fetch call with no args.
  expectType<Promise<User[]>>(api.fetchList())

  // args-query: direct fetch call with args.
  expectType<Promise<User>>(api.fetchUser('1'))

  // --- Wrong-shape calls are type errors ---

  // @ts-expect-error — fetchUser requires args
  api.fetchUser()

  // @ts-expect-error — void query must not take an args object
  api.fetchList('1')

  // @ts-expect-error — direct query fetches do not expose handle methods
  api.fetchUser.fetch('1')

  useQuery(userModel.fetchUser, ['1'])
  useQuery(api.fetchUser, ['1'])

  // @ts-expect-error — unknown property on ModelAPI
  api.nonExistentQuery

  // @ts-expect-error — cannot call state as a function
  api.count()

  // --- State / actions / views typing still works ---

  expectType<number>(api.count)
  expectType<void>(api.bump())
}

// Detached model variant — same typing guarantees.
export function TestUseDetachedModelQueryTypes() {
  // @ts-expect-error — explicit name overloads were removed
  useModel('user', userModel)

  const api = useDetachedModel(userModel)

  expectType<QueryFetch<[], User[]>>(api.fetchList)
  expectType<QueryFetch<[string], User>>(api.fetchUser)
  // @ts-expect-error — ModelAPI does not expose query handles
  api.$queries
  expectType<Promise<User>>(api.fetchUser('1'))
  expectType<number>(api.count)
}
