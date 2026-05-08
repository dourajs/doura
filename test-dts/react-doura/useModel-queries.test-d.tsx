import { defineModel, QueryHandle, QueryCtx } from 'doura'
import { useModel } from 'react-doura'
import { expectType } from '../helper'

interface User {
  id: string
  name: string
}

const userModel = defineModel({
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
    // args query (full spec)
    fetchUserSpec: {
      fn: (ctx, id: string) => {
        expectType<QueryCtx>(ctx)
        return Promise.resolve<User>({ id, name: 'Spec ' + id })
      },
    },
  },
})

export function TestUseModelQueryTypes() {
  // Named model — the returned api is the merged ModelAPI which includes
  // queries alongside state/views/actions.
  const api = useModel('user', userModel)

  // --- Query handles surface with full inference, not `any` ---

  expectType<QueryHandle<[], User[]>>(api.fetchList)
  expectType<QueryHandle<[string], User>>(api.fetchUser)
  expectType<QueryHandle<[string], User>>(api.fetchUserSpec)

  // Handle descriptor fields are typed.
  expectType<string>(api.fetchList._queryName)

  // --- Runtime methods carry the inferred TArgs / TData ---

  // void-args: call with no args
  expectType<User[] | undefined>(api.fetchList.getData())
  expectType<boolean>(api.fetchList.isFetching())
  expectType<boolean>(api.fetchList.isStale())
  expectType<Promise<User[]>>(api.fetchList.fetch())
  api.fetchList.setData([{ id: '1', name: 'Alice' }])

  // args-query: call with args
  expectType<User | undefined>(api.fetchUser.getData('1'))
  expectType<boolean>(api.fetchUser.isFetching('1'))
  expectType<Promise<User>>(api.fetchUser.fetch('1'))
  api.fetchUser.setData('1', { id: '1', name: 'Alice' })

  // invalidate / reset accept either specific args or "all entries".
  api.fetchUser.invalidate()
  api.fetchUser.invalidate('1')
  api.fetchUser.reset()
  api.fetchUser.reset('1')
  api.fetchList.invalidate()
  api.fetchList.reset()

  // --- Wrong-shape calls are type errors ---

  // @ts-expect-error — fetchUser requires args
  api.fetchUser.getData()

  // @ts-expect-error — void query must not take an args object
  api.fetchList.getData('1')

  // Explicit shape check of the conditional setData signature.
  const setUser: (id: string, data: User) => void = api.fetchUser.setData
  expectType<(id: string, data: User) => void>(setUser)
  const setList: (data: User[]) => void = api.fetchList.setData
  expectType<(data: User[]) => void>(setList)

  // @ts-expect-error — data must match TData (User), not a number
  api.fetchUser.setData('1', 42)

  // @ts-expect-error — data for void query must be User[], not a string
  api.fetchList.setData('not an array')

  // @ts-expect-error — unknown property on ModelAPI
  api.nonExistentQuery

  // @ts-expect-error — cannot call state as a function
  api.count()

  // --- State / actions / views typing still works ---

  expectType<number>(api.count)
  expectType<void>(api.bump())
}

// Anonymous model variant — same typing guarantees.
export function TestUseModelAnonymousQueryTypes() {
  const api = useModel(userModel)

  expectType<QueryHandle<[], User[]>>(api.fetchList)
  expectType<QueryHandle<[string], User>>(api.fetchUser)
  expectType<Promise<User>>(api.fetchUser.fetch('1'))
  expectType<number>(api.count)
}
