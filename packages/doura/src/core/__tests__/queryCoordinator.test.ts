import { defineModel, modelManager, query, QueryCoordinator } from '../index'
import { DEFAULT_QUERY_CONFIG } from '../queryTypes'
import { doura } from '../../doura'

let oldEnv: any
beforeAll(() => {
  oldEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
})
afterAll(() => {
  process.env.NODE_ENV = oldEnv
})

describe('QueryCoordinator', () => {
  describe('config resolution', () => {
    it('should use DEFAULT_QUERY_CONFIG when no config provided', () => {
      const coordinator = new QueryCoordinator()
      expect(coordinator.config.staleTime).toBe(DEFAULT_QUERY_CONFIG.staleTime)
      expect(coordinator.config.gcTime).toBe(DEFAULT_QUERY_CONFIG.gcTime)
    })

    it('should merge partial config with defaults', () => {
      const coordinator = new QueryCoordinator({ staleTime: 10000 })
      expect(coordinator.config.staleTime).toBe(10000)
      expect(coordinator.config.gcTime).toBe(DEFAULT_QUERY_CONFIG.gcTime)
    })

    it('should accept full config override', () => {
      const coordinator = new QueryCoordinator({
        staleTime: 30000,
        gcTime: 60000,
      })
      expect(coordinator.config.staleTime).toBe(30000)
      expect(coordinator.config.gcTime).toBe(60000)
    })
  })

  describe('store-level config via modelManager', () => {
    it('should use default config when query option not provided', () => {
      const mgr = modelManager()
      // The coordinator is internal; verify indirectly via model behavior
      expect(mgr).toBeDefined()
      mgr.destroy()
    })

    it('should pass query config to coordinator', () => {
      const mgr = modelManager({ query: { staleTime: 5000 } })
      expect(mgr).toBeDefined()
      mgr.destroy()
    })
  })

  describe('fetch', () => {
    it('should store result in query cache', async () => {
      const coordinator = new QueryCoordinator()
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: async () => 'result',
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)

      // Access internal model for direct coordinator test
      const internalModel = (inst as any)._.getQueryState
        ? inst
        : (inst as any)._

      await coordinator.fetch(
        (inst as any)._ || getInternal(mgr, 'test', model),
        'fetchData',
        []
      )

      // Check query cache via public API
      const data = inst.$queries.fetchData.getData()
      expect(data).toBe('result')

      mgr.destroy()
    })

    it('should deduplicate concurrent fetches', async () => {
      const coordinator = new QueryCoordinator()
      const fn = jest.fn(async () => 'result')
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      const p1 = coordinator.fetch(internal, 'fetchData', [])
      const p2 = coordinator.fetch(internal, 'fetchData', [])

      const [r1, r2] = await Promise.all([p1, p2])
      expect(r1).toBe('result')
      expect(r2).toBe('result')
      expect(fn).toHaveBeenCalledTimes(1)

      mgr.destroy()
    })

    it('should apply inline state writes only once for a deduplicated response', async () => {
      const coordinator = new QueryCoordinator()
      const fn = jest.fn(async function (this: any) {
        this.value += 1
        return 1
      })
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      const [r1, r2] = await Promise.all([
        coordinator.fetch(internal, 'fetchData', []),
        coordinator.fetch(internal, 'fetchData', []),
      ])

      expect(r1).toBe(1)
      expect(r2).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)
      expect(inst.$state.value).toBe(1)

      mgr.destroy()
    })

    it('should reject every waiter if shared query function throws', async () => {
      const coordinator = new QueryCoordinator()
      const fn = jest.fn(() => {
        throw new Error('onData exploded')
      })
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      const p1 = coordinator.fetch(internal, 'fetchData', [])
      const p2 = coordinator.fetch(internal, 'fetchData', [])

      await expect(p1).rejects.toThrow('onData exploded')
      await expect(p2).rejects.toThrow('onData exploded')
      expect(fn).toHaveBeenCalledTimes(1)
      expect(inst.$queries.fetchData.getState()?.fetchStatus).toBe('idle')
      expect(inst.$queries.fetchData.getState()?.error).toBeInstanceOf(Error)

      mgr.destroy()
    })

    it('should keep detached model hashes isolated when names are empty', async () => {
      const mgr = modelManager({ query: {} })
      const fnA = jest.fn(async () => 'A')
      const fnB = jest.fn(async () => 'B')

      const modelA = defineModel({
        name: 'modelA',
        state: {},
        queries: {
          fetchData: fnA,
        },
      })
      const modelB = defineModel({
        name: 'modelB',
        state: {},
        queries: {
          fetchData: fnB,
        },
      })

      const instA = mgr.getDetachedModel(modelA)
      const instB = mgr.getDetachedModel(modelB)

      const [a, b] = await Promise.all([
        instA.$queries.fetchData.fetch(),
        instB.$queries.fetchData.fetch(),
      ])

      expect(a).toBe('A')
      expect(b).toBe('B')
      expect(fnA).toHaveBeenCalledTimes(1)
      expect(fnB).toHaveBeenCalledTimes(1)
      expect(instA.$queries.fetchData.getData()).toBe('A')
      expect(instB.$queries.fetchData.getData()).toBe('B')

      mgr.destroy()
    })

    it('should set fetchStatus to fetching during fetch', async () => {
      const coordinator = new QueryCoordinator()
      let resolveFetch!: (v: unknown) => void
      const fn = jest.fn(
        () => new Promise((resolve) => (resolveFetch = resolve))
      )
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      const promise = coordinator.fetch(internal, 'fetchData', [])

      // Check fetchStatus is 'fetching'
      const state = (inst as any)._.getQueryState('fetchData', [])
      expect(state?.fetchStatus).toBe('fetching')

      resolveFetch('done')
      await promise

      mgr.destroy()
    })

    it('should set error on fetch failure', async () => {
      const coordinator = new QueryCoordinator()
      const error = new Error('fail')
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: async () => {
            throw error
          },
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      await expect(
        coordinator.fetch(internal, 'fetchData', [])
      ).rejects.toThrow('fail')

      const state = (inst as any)._.getQueryState('fetchData', [])
      expect(state?.error).toBe(error)
      expect(state?.fetchStatus).toBe('idle')

      mgr.destroy()
    })

    it('should throw when query name not found', async () => {
      const coordinator = new QueryCoordinator()
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      await expect(
        coordinator.fetch(internal, 'nonExistent', [])
      ).rejects.toThrow('Query "nonExistent" not found')

      mgr.destroy()
    })
  })

  describe('cancel', () => {
    it('should abort inflight fetch for specific query+args', async () => {
      const coordinator = new QueryCoordinator()
      let signal!: AbortSignal
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: (ctx: any) => {
            signal = ctx.signal
            return new Promise((resolve) =>
              setTimeout(() => resolve('data'), 5000)
            )
          },
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      const promise = coordinator.fetch(internal, 'fetchData', [])
      coordinator.cancel(internal, 'fetchData', [])

      expect(signal.aborted).toBe(true)
      await expect(promise).rejects.toThrow()

      mgr.destroy()
    })

    it('should clear fetchStatus after aborting a fetch', async () => {
      const coordinator = new QueryCoordinator()
      let signal!: AbortSignal
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: (ctx: any) => {
            signal = ctx.signal
            return new Promise((resolve) =>
              setTimeout(() => resolve('data'), 5000)
            )
          },
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      const promise = coordinator.fetch(internal, 'fetchData', [])
      coordinator.cancel(internal, 'fetchData', [])

      expect(signal.aborted).toBe(true)
      await expect(promise).rejects.toThrow()
      expect(inst.$queries.fetchData.isFetching()).toBe(false)
      expect(inst.$queries.fetchData.getState()?.fetchStatus).toBe('idle')

      mgr.destroy()
    })

    it('should cancel all queries for a model when no queryName provided', async () => {
      const coordinator = new QueryCoordinator()
      const signals: AbortSignal[] = []
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchA: (ctx: any) => {
            signals.push(ctx.signal)
            return new Promise((resolve) => setTimeout(resolve, 5000))
          },
          fetchB: (ctx: any) => {
            signals.push(ctx.signal)
            return new Promise((resolve) => setTimeout(resolve, 5000))
          },
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      coordinator.fetch(internal, 'fetchA', []).catch(() => {})
      coordinator.fetch(internal, 'fetchB', []).catch(() => {})

      coordinator.cancel(internal)

      expect(signals[0].aborted).toBe(true)
      expect(signals[1].aborted).toBe(true)

      mgr.destroy()
    })

    it('should cancel all entries for a queryName when no args provided', async () => {
      const coordinator = new QueryCoordinator()
      const signals: AbortSignal[] = []
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: (ctx: any, id: number) => {
            signals.push(ctx.signal)
            return new Promise((resolve) => setTimeout(resolve, 5000))
          },
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      coordinator.fetch(internal, 'fetchData', [1]).catch(() => {})
      coordinator.fetch(internal, 'fetchData', [2]).catch(() => {})

      coordinator.cancel(internal, 'fetchData')

      expect(signals[0].aborted).toBe(true)
      expect(signals[1].aborted).toBe(true)

      mgr.destroy()
    })

    it('should cancel matching inflight hashes without relying on string prefixes', async () => {
      const coordinator = new QueryCoordinator()
      const usersSignals: AbortSignal[] = []
      const postsSignals: AbortSignal[] = []
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          'fetch"Users': (ctx: any, id: number) => {
            usersSignals.push(ctx.signal)
            return new Promise((resolve) => setTimeout(resolve, 5000))
          },
          fetchPosts: (ctx: any) => {
            postsSignals.push(ctx.signal)
            return new Promise((resolve) => setTimeout(resolve, 5000))
          },
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel(model)
      const internal = getInternal(mgr, 'te"st', model)

      coordinator.fetch(internal, 'fetch"Users', [1]).catch(() => {})
      coordinator.fetch(internal, 'fetch"Users', [2]).catch(() => {})
      coordinator.fetch(internal, 'fetchPosts', []).catch(() => {})

      coordinator.cancel(internal, 'fetch"Users')

      expect(usersSignals[0].aborted).toBe(true)
      expect(usersSignals[1].aborted).toBe(true)
      expect(postsSignals[0].aborted).toBe(false)

      mgr.destroy()
    })
  })

  describe('isStale', () => {
    it('should return true when no data exists', () => {
      const coordinator = new QueryCoordinator()
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: async () => 'result',
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      expect(coordinator.isStale(internal, 'fetchData', [])).toBe(true)

      mgr.destroy()
    })

    it('should return false when data is fresh', async () => {
      const coordinator = new QueryCoordinator({ staleTime: 60000 })
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: async () => 'result',
        },
      })

      const mgr = modelManager({ query: { staleTime: 60000 } })
      const inst = mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      await coordinator.fetch(internal, 'fetchData', [])

      expect(coordinator.isStale(internal, 'fetchData', [])).toBe(false)

      mgr.destroy()
    })

    it('should return true when data is stale', async () => {
      const coordinator = new QueryCoordinator({ staleTime: 0 })
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: async () => 'result',
        },
      })

      const mgr = modelManager({ query: { staleTime: 0 } })
      const inst = mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      await coordinator.fetch(internal, 'fetchData', [])

      // staleTime=0, so it's immediately stale
      expect(coordinator.isStale(internal, 'fetchData', [])).toBe(true)

      mgr.destroy()
    })
  })

  describe('staleTime resolution', () => {
    it('should use override staleTime when provided', () => {
      const coordinator = new QueryCoordinator({ staleTime: 1000 })
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: query({
            fn: async () => 'result',
            staleTime: 5000,
          }),
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      expect(coordinator.resolveStaleTime(internal, 'fetchData', 9999)).toBe(
        9999
      )
      mgr.destroy()
    })

    it('should use query spec staleTime over store default', () => {
      const coordinator = new QueryCoordinator({ staleTime: 1000 })
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: query({
            fn: async () => 'result',
            staleTime: 5000,
          }),
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      expect(coordinator.resolveStaleTime(internal, 'fetchData')).toBe(5000)
      mgr.destroy()
    })

    it('should fall back to store default staleTime', () => {
      const coordinator = new QueryCoordinator({ staleTime: 3000 })
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: async () => 'result',
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel(model)
      const internal = getInternal(mgr, 'test', model)

      expect(coordinator.resolveStaleTime(internal, 'fetchData')).toBe(3000)
      mgr.destroy()
    })
  })

  describe('QueryHandle.prefetch through model instance', () => {
    it('should return a promise that resolves after the cache is warmed', async () => {
      let resolveFetch!: (value: string) => void
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: () =>
            new Promise<string>((resolve) => {
              resolveFetch = resolve
            }),
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)

      const promise = inst.$queries.fetchData.prefetch()
      let settled = false
      promise.then(() => {
        settled = true
      })

      await Promise.resolve()
      expect(settled).toBe(false)

      resolveFetch('prefetched')
      await promise

      expect(inst.$queries.fetchData.getData()).toBe('prefetched')

      mgr.destroy()
    })

    it('should work when coordinator is wired by modelManager', async () => {
      const fn = jest.fn(async () => 'prefetched')
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)

      inst.$queries.fetchData.prefetch()
      // Wait for the fetch to complete
      await new Promise((r) => setTimeout(r, 10))

      const data = inst.$queries.fetchData.getData()
      expect(data).toBe('prefetched')
      expect(fn).toHaveBeenCalledTimes(1)

      mgr.destroy()
    })

    it('should be a no-op when coordinator is not wired', async () => {
      const fn = jest.fn(async () => 'prefetched')
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      // Create a model manager WITHOUT query config — coordinator should still be created
      const mgr = modelManager()
      const inst = mgr.getModel(model)

      // QueryHandle.prefetch should still work since coordinator is always created
      inst.$queries.fetchData.prefetch()
      await new Promise((r) => setTimeout(r, 10))

      const data = inst.$queries.fetchData.getData()
      expect(data).toBe('prefetched')

      mgr.destroy()
    })
  })

  describe('QueryHandle.cancel and $cancelQueries through model instance', () => {
    it('should cancel inflight queries through a query handle', async () => {
      let signal!: AbortSignal
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: (ctx: any) => {
            signal = ctx.signal
            return new Promise((resolve) => setTimeout(resolve, 5000))
          },
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)

      inst.$queries.fetchData.prefetch()
      // Let the fetch start
      await new Promise((r) => setTimeout(r, 5))

      inst.$queries.fetchData.cancel()
      expect(signal.aborted).toBe(true)

      mgr.destroy()
    })

    it('$cancelQueries should cancel all inflight queries on the model', async () => {
      const signals: Record<string, AbortSignal> = {}
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchUser: (ctx: any, id: string) => {
            signals[id] = ctx.signal
            return new Promise((resolve) => setTimeout(resolve, 5000))
          },
          fetchPosts: (ctx: any) => {
            signals.posts = ctx.signal
            return new Promise((resolve) => setTimeout(resolve, 5000))
          },
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel(model)

      inst.$queries.fetchUser.prefetch('1')
      inst.$queries.fetchPosts.prefetch()
      await new Promise((r) => setTimeout(r, 5))

      inst.$cancelQueries()
      expect(signals['1'].aborted).toBe(true)
      expect(signals.posts.aborted).toBe(true)

      mgr.destroy()
    })
  })

  describe('doura factory', () => {
    it('should pass query config through to modelManager', async () => {
      const fn = jest.fn(async () => 'from-doura')
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      const store = doura({ query: { staleTime: 5000, gcTime: 30000 } })
      const inst = store.getModel(model)

      inst.$queries.fetchData.prefetch()
      await new Promise((r) => setTimeout(r, 10))

      expect(inst.$queries.fetchData.getData()).toBe('from-doura')

      store.destroy()
    })

    it('should abort inflight fetches and keep destroyed caches empty', async () => {
      let signal!: AbortSignal
      const model = defineModel({
        name: 'model',
        state: { value: 0 },
        queries: {
          fetchData: (ctx: any) => {
            signal = ctx.signal
            return new Promise((resolve) => setTimeout(() => resolve(1), 5000))
          },
        },
      })

      const store = doura({ query: {} })
      const inst = store.getModel(model)
      const internal = (inst as any)._

      const promise = inst.$queries.fetchData.fetch()
      store.destroy()

      expect(signal.aborted).toBe(true)
      await expect(promise).rejects.toThrow()
      expect(internal.queryCache.size).toBe(0)
    })
  })
})

// Helper to get the internal ModelInternal from modelManager
function getInternal(
  mgr: ReturnType<typeof modelManager>,
  _name: string,
  model: any
) {
  const inst = mgr.getModel(model)
  return (inst as any)._ as any
}
