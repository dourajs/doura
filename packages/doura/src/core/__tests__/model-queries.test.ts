import {
  defineModel,
  modelManager,
  computeQueryHash,
  computeArgsKey,
} from '../index'

let modelMgr: ReturnType<typeof modelManager>
beforeEach(() => {
  modelMgr = modelManager()
})

let oldEnv: any
beforeAll(() => {
  oldEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
})
afterAll(() => {
  process.env.NODE_ENV = oldEnv
})

describe('model queries', () => {
  describe('query normalization in ModelInternal', () => {
    it('should normalize shorthand (bare function) into { fn: ... }', () => {
      const fetchUser = async () => ({ id: 1 })
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser,
        },
      })

      const inst = modelMgr.getModel(model)
      expect(inst.$queries.fetchUser).toBeDefined()
      expect((inst.$queries.fetchUser as any)._spec.fn).toBe(fetchUser)
    })

    it('should preserve only supported spec options (fn, staleTime)', () => {
      const fn = async (_ctx: any, id: number) => ({ id })
      const key = (args: { id: number }) => ['user', args.id]
      const onData = (ctx: any, data: any) => {
        ctx.state.user = data
      }

      const model = defineModel({
        name: 'model',
        state: { user: null as { id: number } | null },
        queries: {
          fetchUser: {
            fn,
            key,
            staleTime: 5000,
            onData,
          } as any,
        },
      })

      const inst = modelMgr.getModel(model)
      const handle = inst.$queries.fetchUser as any
      expect(handle._spec.fn).toBe(fn)
      expect(handle._spec.staleTime).toBe(5000)
      expect((handle._spec as any).key).toBeUndefined()
      expect((handle._spec as any).onData).toBeUndefined()
      expect(
        `query "fetchUser" uses removed option "key"; cache identity now comes from query args`
      ).toHaveBeenWarned()
      expect(
        `query "fetchUser" uses removed option "onData"; write state inside "fn"`
      ).toHaveBeenWarned()
    })

    it('should have no queries when no queries option', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
      })
      const inst = modelMgr.getModel(model)
      expect(Object.keys(inst.$queries)).toHaveLength(0)
    })
  })

  describe('query name conflict detection', () => {
    it('should warn when query name conflicts with state key', () => {
      // @ts-expect-error - intentional runtime validation fixture
      const model = defineModel({
        name: 'model',
        state: { fetchUser: 'existing' },
        queries: {
          fetchUser: async () => ({ id: 1, name: '' }),
        },
      })

      modelMgr.getModel(model)
      expect(
        'key "fetchUser" in "queries" is conflicted with the key in "state"'
      ).toHaveBeenWarned()
    })
  })

  describe('queries initialization', () => {
    it('should freeze the queries object', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: async () => ({ id: 1, name: '' }),
        },
      })

      const store = modelMgr.getModel(model)
      expect(Object.isFrozen(store.$queries)).toBe(true)
    })

    it('should expose queries via $queries', () => {
      const fn = async () => ({ id: 1 })
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: fn,
        },
      })

      const store = modelMgr.getModel(model)
      expect(store.$queries.fetchUser).toBeDefined()
      expect((store.$queries.fetchUser as any)._spec.fn).toBe(fn)
    })

    it('should resolve query names from proxy', () => {
      const fn = async () => ({ id: 1 })
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: fn,
        },
      })

      const store = modelMgr.getModel(model)
      expect((store as any).fetchUser).toBeDefined()
      expect((store as any).fetchUser._spec.fn).toBe(fn)
    })

    it('should reject writes to queries', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: async () => ({ id: 1, name: '' }),
        },
      })

      const store = modelMgr.getModel(model)
      expect(() => {
        ;(store as any).fetchUser = 'something'
      }).toThrow()
      expect('Attempting to mutate query "fetchUser"').toHaveBeenWarned()
    })
  })

  describe('QueryHandle getData / setData with isolated storage', () => {
    it('should store and retrieve data from query cache', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: async () => ({ id: 1, name: '' }),
        },
      })

      const store = modelMgr.getModel(model)
      store.$queries.fetchUser.setData({ id: 42, name: 'Alice' })

      const data = store.$queries.fetchUser.getData()
      expect(data).toEqual({ id: 42, name: 'Alice' })
    })

    it('should differentiate by args', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: {
            fn: async (_ctx: any, id: number) => ({
              id,
              name: '',
            }),
          },
        },
      })

      const store = modelMgr.getModel(model)
      store.$queries.fetchUser.setData(1, { id: 1, name: 'Alice' })
      store.$queries.fetchUser.setData(2, { id: 2, name: 'Bob' })

      expect(store.$queries.fetchUser.getData(1)).toEqual({
        id: 1,
        name: 'Alice',
      })
      expect(store.$queries.fetchUser.getData(2)).toEqual({
        id: 2,
        name: 'Bob',
      })
    })
  })

  describe('inline query state mutation', () => {
    it('setData should write cache without mutating model state', () => {
      const model = defineModel({
        name: 'model',
        state: { user: null as any },
        queries: {
          fetchUser: async () => ({ id: 1, name: '' }),
        },
      })

      const store = modelMgr.getModel(model)
      store.$queries.fetchUser.setData({
        id: 1,
        name: 'Alice',
      })

      expect(store.$rawState.user).toBeNull()
      expect(store.$queries.fetchUser.getData()).toEqual({
        id: 1,
        name: 'Alice',
      })
    })

    it('should read from query cache even when model state is populated', () => {
      const model = defineModel({
        name: 'model',
        state: { user: { id: 1, name: 'Alice' } },
        queries: {
          fetchUser: async () => ({ id: 1 }),
        },
      })

      const store = modelMgr.getModel(model)
      const data = store.$queries.fetchUser.getData()
      expect(data).toBeUndefined()
    })

    it('should apply state writes made inside the query function', async () => {
      const model = defineModel({
        name: 'model',
        state: { user: null as any },
        queries: {
          fetchUser: {
            async fn() {
              const user = { id: 1, name: 'Alice' }
              this.user = user
              return user
            },
          },
        },
      })

      const store = modelMgr.getModel(model)
      await store.$queries.fetchUser.fetch()

      expect(store.$rawState.user).toEqual({ id: 1, name: 'Alice' })
      expect(store.$queries.fetchUser.getData()).toEqual({
        id: 1,
        name: 'Alice',
      })
    })
  })

  describe('query invalidation', () => {
    it('handle.invalidate should invalidate a specific args slot', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: {
            fn: async (_ctx: any, id: number) => ({
              id,
              name: '',
            }),
          },
        },
      })

      const store = modelMgr.getModel(model)
      store.$queries.fetchUser.setData(1, { id: 1, name: 'Alice' })
      store.$queries.fetchUser.setData(2, { id: 2, name: 'Bob' })

      // Invalidate only id:1
      store.$queries.fetchUser.invalidate(1)

      // The entry should still exist, but dataUpdatedAt should be 0
      const state = (store as any)._.getQueryState('fetchUser', [1])
      expect(state.dataUpdatedAt).toBe(0)

      // id:2 should be unaffected
      const state2 = (store as any)._.getQueryState('fetchUser', [2])
      expect(state2.dataUpdatedAt).not.toBe(0)
    })

    it('should invalidate all queries when called with no args', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: async () => ({ id: 1 }),
          fetchPosts: async () => [{ id: 1 }],
        },
      })

      const store = modelMgr.getModel(model)
      store.$queries.fetchUser.setData({ id: 1 })
      store.$queries.fetchPosts.setData([{ id: 1 }])

      store.$invalidateQueries()

      const state1 = (store as any)._.getQueryState('fetchUser', [])
      const state2 = (store as any)._.getQueryState('fetchPosts', [])
      expect(state1.dataUpdatedAt).toBe(0)
      expect(state2.dataUpdatedAt).toBe(0)
    })

    it('handle.invalidate should invalidate all args slots for one query', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: {
            fn: async (_ctx: any, id: number) => ({
              id,
            }),
          },
        },
      })

      const store = modelMgr.getModel(model)
      store.$queries.fetchUser.setData(1, { id: 1 })
      store.$queries.fetchUser.setData(2, { id: 2 })

      store.$queries.fetchUser.invalidate()

      const state1 = (store as any)._.getQueryState('fetchUser', [1])
      const state2 = (store as any)._.getQueryState('fetchUser', [2])
      expect(state1.dataUpdatedAt).toBe(0)
      expect(state2.dataUpdatedAt).toBe(0)
    })
  })

  describe('query reset', () => {
    it('should clear query data', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: async () => ({ id: 1 }),
        },
      })

      const store = modelMgr.getModel(model)
      store.$queries.fetchUser.setData({ id: 1 })
      expect(store.$queries.fetchUser.getData()).toEqual({ id: 1 })

      store.$queries.fetchUser.reset()
      expect(store.$queries.fetchUser.getData()).toBeUndefined()
    })

    it('should clear all queries when called with no args', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: async () => ({ id: 1 }),
          fetchPosts: async () => [{ id: 1 }],
        },
      })

      const store = modelMgr.getModel(model)
      store.$queries.fetchUser.setData({ id: 1 })
      store.$queries.fetchPosts.setData([{ id: 1 }])

      store.$resetQueries()

      expect(store.$queries.fetchUser.getData()).toBeUndefined()
      expect(store.$queries.fetchPosts.getData()).toBeUndefined()
    })
  })

  describe('query cache subscription and notification', () => {
    it('should notify subscribers when query state changes', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: async () => ({ id: 1 }),
        },
      })

      const store = modelMgr.getModel(model)
      const listener = jest.fn()

      const unsub = (store as any)._.subscribeQuery('fetchUser', [], listener)

      store.$queries.fetchUser.setData({ id: 1 })
      expect(listener).toHaveBeenCalledTimes(1)

      store.$queries.fetchUser.setData({ id: 2 })
      expect(listener).toHaveBeenCalledTimes(2)

      unsub()
      store.$queries.fetchUser.setData({ id: 3 })
      expect(listener).toHaveBeenCalledTimes(2) // no more calls
    })
  })

  describe('destroy cleanup', () => {
    it('should clear all query caches on destroy', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: async () => ({ id: 1 }),
        },
      })

      const store = modelMgr.getModel(model)
      const instance = (store as any)._

      store.$queries.fetchUser.setData({ id: 1 })

      instance.destroy()

      expect(instance.queryCache.size).toBe(0)
      expect(instance.queryNotifiers.size).toBe(0)
      expect(instance._queryIndex.size).toBe(0)
    })
  })

  describe('observer notification after invalidation/reset', () => {
    const model = defineModel({
      name: 'model',
      state: { value: 0 },
      queries: {
        fetchData: {
          fn: async (_ctx: any, id: string) => ({ id }),
        },
      },
    })

    it('handle.invalidate should notify observers and produce new entry reference', () => {
      const inst = modelMgr.getModel(model)
      const internal = (inst as any)._

      // Seed data
      inst.$queries.fetchData.setData('1', { id: '1' })

      // Capture original entry reference
      const entryBefore = internal.getQueryState('fetchData', ['1'])

      // Subscribe
      const listener = jest.fn()
      internal.subscribeQuery('fetchData', ['1'], listener)

      // Invalidate
      inst.$queries.fetchData.invalidate('1')
      expect(listener).toHaveBeenCalledTimes(1)

      // Entry reference must change (for useSyncExternalStore)
      const entryAfter = internal.getQueryState('fetchData', ['1'])
      expect(entryAfter).not.toBe(entryBefore)
      expect(entryAfter.dataUpdatedAt).toBe(0)
      expect(entryAfter.data).toEqual({ id: '1' }) // data preserved
    })

    it('$invalidateQueries() without args should notify all observers', () => {
      const inst = modelMgr.getModel(model)
      const internal = (inst as any)._

      inst.$queries.fetchData.setData('1', { id: '1' })
      inst.$queries.fetchData.setData('2', { id: '2' })

      const listener1 = jest.fn()
      const listener2 = jest.fn()
      internal.subscribeQuery('fetchData', ['1'], listener1)
      internal.subscribeQuery('fetchData', ['2'], listener2)

      inst.$invalidateQueries()
      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
    })

    it('handle.reset should notify observers', () => {
      const inst = modelMgr.getModel(model)
      const internal = (inst as any)._

      inst.$queries.fetchData.setData('1', { id: '1' })

      const listener = jest.fn()
      internal.subscribeQuery('fetchData', ['1'], listener)

      inst.$queries.fetchData.reset('1')
      expect(listener).toHaveBeenCalled()
    })

    it('$resetQueries() without args should notify all observers', () => {
      const inst = modelMgr.getModel(model)
      const internal = (inst as any)._

      inst.$queries.fetchData.setData('1', { id: '1' })

      const listener = jest.fn()
      internal.subscribeQuery('fetchData', ['1'], listener)

      inst.$resetQueries()
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('removed onData option', () => {
    it('should ignore onData at runtime without wedging the model', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          broken: {
            fn: async (_ctx: any) => 42,
            onData: () => {
              throw new Error('onData exploded')
            },
          } as any,
        },
      })

      const inst = modelMgr.getModel(model)
      const internal = (inst as any)._

      inst.$queries.broken.setData(42)

      expect(
        `query "broken" uses removed option "onData"; write state inside "fn"`
      ).toHaveBeenWarned()
      expect(internal._watchStateChange).toBe(true)
      expect(inst.$queries.broken.getData()).toBe(42)

      // Model should still be functional — state changes should work
      internal.stateRef.value.value = 99
      internal._update()
      expect(inst.$state.value).toBe(99)
    })
  })

  describe('QueryHandle runtime methods', () => {
    const voidModel = defineModel({
      name: 'voidModel',
      state: { sentinel: 0 },
      queries: {
        fetchData: (_ctx: any) => Promise.resolve(42),
      },
    })

    const argsModel = defineModel({
      name: 'argsModel',
      state: { sentinel: 0 },
      queries: {
        fetchUser: {
          fn: (_ctx: any, id: string) =>
            Promise.resolve({ id, name: 'User ' + id }),
        },
      },
    })

    it('handle identity matches $queries, proxy access, and getApi()', () => {
      const inst = modelMgr.getModel(voidModel)
      const viaQueries = inst.$queries.fetchData
      const viaProxy = (inst as any).fetchData
      const viaApi = (inst.$getApi() as any).fetchData

      expect(viaQueries).toBe(viaProxy)
      expect(viaQueries).toBe(viaApi)
      const internalHandle = viaQueries as any
      expect(internalHandle._queryName).toBe('fetchData')
      expect(internalHandle._model).toBe(inst)
      expect(internalHandle._spec.fn).toBeInstanceOf(Function)
    })

    it('getData / getState — void query returns undefined before any cache write', () => {
      const inst = modelMgr.getModel(voidModel)
      expect(inst.$queries.fetchData.getData()).toBeUndefined()
      expect(inst.$queries.fetchData.getState()).toBeUndefined()
    })

    it('getData / getState reflect setQueryData — void query', () => {
      const inst = modelMgr.getModel(voidModel)
      inst.$queries.fetchData.setData(7)
      expect(inst.$queries.fetchData.getData()).toBe(7)
      const state = inst.$queries.fetchData.getState()
      expect(state).toBeDefined()
      expect(state!.data).toBe(7)
      expect(state!.fetchStatus).toBe('idle')
      expect(state!.dataUpdatedAt).toBeGreaterThan(0)
    })

    it('getData / getState reflect setQueryData — args query', () => {
      const inst = modelMgr.getModel(argsModel)
      inst.$queries.fetchUser.setData('1', { id: '1', name: 'Alice' })
      expect(inst.$queries.fetchUser.getData('1')).toEqual({
        id: '1',
        name: 'Alice',
      })
      expect(inst.$queries.fetchUser.getData('2')).toBeUndefined()
    })

    it('setData via handle — void case writes cache and triggers notifier', () => {
      const inst = modelMgr.getModel(voidModel)
      const listener = jest.fn()
      const internal = (inst as any)._
      const unsub = internal.subscribeQuery('fetchData', [], listener)

      inst.$queries.fetchData.setData(123)
      expect(listener).toHaveBeenCalled()
      expect(inst.$queries.fetchData.getData()).toBe(123)

      unsub()
    })

    it('setData via handle — args case writes cache for the given args', () => {
      const inst = modelMgr.getModel(argsModel)
      inst.$queries.fetchUser.setData('x', { id: 'x', name: 'Xena' })
      expect(inst.$queries.fetchUser.getData('x')).toEqual({
        id: 'x',
        name: 'Xena',
      })
    })

    it('isFetching reflects fetchStatus transitions', () => {
      const inst = modelMgr.getModel(voidModel)
      expect(inst.$queries.fetchData.isFetching()).toBe(false)

      const internal = (inst as any)._
      internal.setQueryState('fetchData', [], {
        data: undefined,
        error: undefined,
        dataUpdatedAt: 0,
        fetchStatus: 'fetching',
      })
      expect(inst.$queries.fetchData.isFetching()).toBe(true)

      internal.setQueryState('fetchData', [], {
        data: 1,
        error: undefined,
        dataUpdatedAt: Date.now(),
        fetchStatus: 'idle',
      })
      expect(inst.$queries.fetchData.isFetching()).toBe(false)
    })

    it('isStale — no data is always stale; fresh data under staleTime is not', () => {
      const freshModel = defineModel({
        name: 'stale',
        state: {},
        queries: {
          fetchFresh: {
            fn: (_ctx: any) => Promise.resolve(1),
            staleTime: 60_000,
          },
        },
      })
      const inst = modelMgr.getModel(freshModel)

      // No data yet → stale
      expect(inst.$queries.fetchFresh.isStale()).toBe(true)

      // Populate with fresh timestamp
      inst.$queries.fetchFresh.setData(1)
      expect(inst.$queries.fetchFresh.isStale()).toBe(false)

      // Simulate old timestamp → stale
      const internal = (inst as any)._
      const hash = computeQueryHash(
        internal.name,
        'fetchFresh',
        computeArgsKey([])
      )
      const entry = internal.queryCache.get(hash)
      internal.queryCache.set(hash, {
        ...entry,
        dataUpdatedAt: Date.now() - 120_000,
      })
      expect(inst.$queries.fetchFresh.isStale()).toBe(true)
    })

    it('fetch via handle — delegates to coordinator and populates cache', async () => {
      const inst = modelMgr.getModel(argsModel)
      const result = await inst.$queries.fetchUser.fetch('7')
      expect(result).toEqual({ id: '7', name: 'User 7' })
      expect(inst.$queries.fetchUser.getData('7')).toEqual({
        id: '7',
        name: 'User 7',
      })
    })

    it('prefetch via handle — resolves void and populates cache', async () => {
      const inst = modelMgr.getModel(argsModel)
      const result = await inst.$queries.fetchUser.prefetch('8')

      expect(result).toBeUndefined()
      expect(inst.$queries.fetchUser.getData('8')).toEqual({
        id: '8',
        name: 'User 8',
      })
    })

    it('fetch via handle — rejects on spec fn rejection', async () => {
      const failModel = defineModel({
        name: 'handleFetchFail',
        state: {},
        queries: {
          fetchBroken: (_ctx: any) => Promise.reject(new Error('boom')),
        },
      })
      const inst = modelMgr.getModel(failModel)
      await expect(inst.$queries.fetchBroken.fetch()).rejects.toThrow('boom')
      // Error is stored in cache
      const state = inst.$queries.fetchBroken.getState()
      expect(state?.error).toBeInstanceOf(Error)
    })

    it('invalidate via handle — marks specific args entry stale', () => {
      const inst = modelMgr.getModel(argsModel)
      inst.$queries.fetchUser.setData('1', { id: '1', name: 'A' })
      inst.$queries.fetchUser.setData('2', { id: '2', name: 'B' })

      inst.$queries.fetchUser.invalidate('1')
      expect(inst.$queries.fetchUser.getState('1')!.dataUpdatedAt).toBe(0)
      expect(
        inst.$queries.fetchUser.getState('2')!.dataUpdatedAt
      ).toBeGreaterThan(0)
    })

    it('invalidate via handle — no args marks all entries of this query stale', () => {
      const inst = modelMgr.getModel(argsModel)
      inst.$queries.fetchUser.setData('1', { id: '1', name: 'A' })
      inst.$queries.fetchUser.setData('2', { id: '2', name: 'B' })

      inst.$queries.fetchUser.invalidate()
      expect(inst.$queries.fetchUser.getState('1')!.dataUpdatedAt).toBe(0)
      expect(inst.$queries.fetchUser.getState('2')!.dataUpdatedAt).toBe(0)
    })

    it('cancel via handle — cancels a specific args slot', async () => {
      const signals: Record<string, AbortSignal> = {}
      const model = defineModel({
        name: 'model',
        state: {},
        queries: {
          fetchUser: {
            fn: (ctx: any, id: string) => {
              signals[id] = ctx.signal
              return new Promise((resolve) => setTimeout(resolve, 5000))
            },
          },
        },
      })
      const inst = modelMgr.getModel(model)

      const p1 = inst.$queries.fetchUser.fetch('1').catch(() => undefined)
      const p2 = inst.$queries.fetchUser.fetch('2').catch(() => undefined)
      await new Promise((r) => setTimeout(r, 5))

      inst.$queries.fetchUser.cancel('1')
      expect(signals['1'].aborted).toBe(true)
      expect(signals['2'].aborted).toBe(false)

      inst.$queries.fetchUser.cancel()
      expect(signals['2'].aborted).toBe(true)
      await Promise.all([p1, p2])
    })

    it('reset via handle — clears cache entry', () => {
      const inst = modelMgr.getModel(argsModel)
      inst.$queries.fetchUser.setData('1', { id: '1', name: 'A' })
      expect(inst.$queries.fetchUser.getData('1')).toBeDefined()

      inst.$queries.fetchUser.reset('1')
      expect(inst.$queries.fetchUser.getData('1')).toBeUndefined()
    })

    it('composed model reaches child queries via models with typed handle', async () => {
      const parent = defineModel({
        name: 'handleParent',
        state: { touched: 0 },
        models: [argsModel],
        actions: {
          async prime() {
            if (!this.argsModel.fetchUser.getData('p')) {
              await this.argsModel.fetchUser.fetch('p')
            }
            this.touched = 1
          },
          invalidateChild() {
            this.argsModel.fetchUser.invalidate('p')
          },
        },
      })

      const parentInst = modelMgr.getModel(parent)
      const childInst = modelMgr.getModel(argsModel)

      await parentInst.prime()
      expect(parentInst.touched).toBe(1)
      expect(childInst.$queries.fetchUser.getData('p')).toEqual({
        id: 'p',
        name: 'User p',
      })

      parentInst.invalidateChild()
      expect(childInst.$queries.fetchUser.getState('p')!.dataUpdatedAt).toBe(0)
    })
  })

  describe('cross-model invalidation via models', () => {
    it('invalidates queries on multiple composed models via QueryHandle', () => {
      const userModel = defineModel({
        name: 'userModel',
        state: {},
        queries: {
          fetchUser: {
            fn: (_ctx: any, id: string) => Promise.resolve({ id }),
          },
        },
      })

      const postModel = defineModel({
        name: 'crossPosts',
        state: {},
        queries: {
          fetchPosts: (_ctx: any) => Promise.resolve([] as string[]),
        },
      })

      const composedModel = defineModel({
        name: 'composedModel',
        state: {},
        models: [userModel, postModel],
        actions: {
          invalidateAll() {
            this.userModel.fetchUser.invalidate()
            this.crossPosts.fetchPosts.invalidate()
          },
        },
      })

      // Prime the child caches with data.
      const usersInst = modelMgr.getModel(userModel)
      const postsInst = modelMgr.getModel(postModel)
      usersInst.$queries.fetchUser.setData('1', { id: '1' })
      usersInst.$queries.fetchUser.setData('2', { id: '2' })
      postsInst.$queries.fetchPosts.setData([])

      // Confirm fresh before invalidating.
      const usersInternal = (usersInst as any)._
      const postsInternal = (postsInst as any)._
      const userHash1 = computeQueryHash(
        usersInternal.name,
        'fetchUser',
        computeArgsKey(['1'])
      )
      const userHash2 = computeQueryHash(
        usersInternal.name,
        'fetchUser',
        computeArgsKey(['2'])
      )
      const postHash = computeQueryHash(
        postsInternal.name,
        'fetchPosts',
        computeArgsKey([])
      )
      expect(
        usersInternal.queryCache.get(userHash1).dataUpdatedAt
      ).toBeGreaterThan(0)
      expect(
        usersInternal.queryCache.get(userHash2).dataUpdatedAt
      ).toBeGreaterThan(0)
      expect(
        postsInternal.queryCache.get(postHash).dataUpdatedAt
      ).toBeGreaterThan(0)

      // Trigger cross-model invalidation from the composed model's action.
      const composed = modelMgr.getModel(composedModel)
      composed.invalidateAll()

      // All matching entries across both children are now stale.
      expect(usersInternal.queryCache.get(userHash1).dataUpdatedAt).toBe(0)
      expect(usersInternal.queryCache.get(userHash2).dataUpdatedAt).toBe(0)
      expect(postsInternal.queryCache.get(postHash).dataUpdatedAt).toBe(0)
    })

    it('QueryHandle.reset from composed action clears child entries entirely', () => {
      const userModel = defineModel({
        name: 'userModel',
        state: {},
        queries: {
          fetchUser: {
            fn: (_ctx: any, id: string) => Promise.resolve({ id }),
          },
        },
      })

      const composedModel = defineModel({
        name: 'composedModel',
        state: {},
        models: [userModel],
        actions: {
          resetUsers() {
            this.userModel.fetchUser.reset()
          },
        },
      })

      const usersInst = modelMgr.getModel(userModel)
      usersInst.$queries.fetchUser.setData('1', { id: '1' })
      expect(usersInst.$queries.fetchUser.getData('1')).toEqual({
        id: '1',
      })

      const composed = modelMgr.getModel(composedModel)
      composed.resetUsers()

      expect(usersInst.$queries.fetchUser.getData('1')).toBeUndefined()
    })
  })
})
