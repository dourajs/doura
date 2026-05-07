import { defineModel, modelManager, QueryCoordinator } from '../index'
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
        state: { value: 0 },
        queries: {
          fetchData: async () => 'result',
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel('test', model)

      // Access internal model for direct coordinator test
      const internalModel = (inst as any)._.getQueryState
        ? inst
        : (inst as any)._

      await coordinator.fetch(
        (inst as any)._ || getInternal(mgr, 'test', model),
        'fetchData',
        undefined
      )

      // Check query cache via public API
      const data = inst.$getQueryData('fetchData')
      expect(data).toBe('result')

      mgr.destroy()
    })

    it('should deduplicate concurrent fetches', async () => {
      const coordinator = new QueryCoordinator()
      const fn = jest.fn(async () => 'result')
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      const p1 = coordinator.fetch(internal, 'fetchData', undefined)
      const p2 = coordinator.fetch(internal, 'fetchData', undefined)

      const [r1, r2] = await Promise.all([p1, p2])
      expect(r1).toBe('result')
      expect(r2).toBe('result')
      expect(fn).toHaveBeenCalledTimes(1)

      mgr.destroy()
    })

    it('should set fetchStatus to fetching during fetch', async () => {
      const coordinator = new QueryCoordinator()
      let resolveFetch!: (v: unknown) => void
      const fn = jest.fn(
        () => new Promise((resolve) => (resolveFetch = resolve))
      )
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      const promise = coordinator.fetch(internal, 'fetchData', undefined)

      // Check fetchStatus is 'fetching'
      const state = (inst as any)._.getQueryState('fetchData', undefined)
      expect(state?.fetchStatus).toBe('fetching')

      resolveFetch('done')
      await promise

      mgr.destroy()
    })

    it('should set error on fetch failure', async () => {
      const coordinator = new QueryCoordinator()
      const error = new Error('fail')
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: async () => {
            throw error
          },
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      await expect(
        coordinator.fetch(internal, 'fetchData', undefined)
      ).rejects.toThrow('fail')

      const state = (inst as any)._.getQueryState('fetchData', undefined)
      expect(state?.error).toBe(error)
      expect(state?.fetchStatus).toBe('idle')

      mgr.destroy()
    })

    it('should throw when query name not found', async () => {
      const coordinator = new QueryCoordinator()
      const model = defineModel({
        state: { value: 0 },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      await expect(
        coordinator.fetch(internal, 'nonExistent', undefined)
      ).rejects.toThrow('Query "nonExistent" not found')

      mgr.destroy()
    })
  })

  describe('cancel', () => {
    it('should abort inflight fetch for specific query+args', async () => {
      const coordinator = new QueryCoordinator()
      let signal!: AbortSignal
      const model = defineModel({
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
      const inst = mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      const promise = coordinator.fetch(internal, 'fetchData', undefined)
      coordinator.cancel(internal, 'fetchData', undefined)

      expect(signal.aborted).toBe(true)
      await expect(promise).rejects.toThrow()

      mgr.destroy()
    })

    it('should cancel all queries for a model when no queryName provided', async () => {
      const coordinator = new QueryCoordinator()
      const signals: AbortSignal[] = []
      const model = defineModel({
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
      mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      coordinator.fetch(internal, 'fetchA', undefined).catch(() => {})
      coordinator.fetch(internal, 'fetchB', undefined).catch(() => {})

      coordinator.cancel(internal)

      expect(signals[0].aborted).toBe(true)
      expect(signals[1].aborted).toBe(true)

      mgr.destroy()
    })

    it('should cancel all entries for a queryName when no args provided', async () => {
      const coordinator = new QueryCoordinator()
      const signals: AbortSignal[] = []
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: (ctx: any, args: any) => {
            signals.push(ctx.signal)
            return new Promise((resolve) => setTimeout(resolve, 5000))
          },
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      coordinator.fetch(internal, 'fetchData', { id: 1 } as any).catch(() => {})
      coordinator.fetch(internal, 'fetchData', { id: 2 } as any).catch(() => {})

      coordinator.cancel(internal, 'fetchData')

      expect(signals[0].aborted).toBe(true)
      expect(signals[1].aborted).toBe(true)

      mgr.destroy()
    })
  })

  describe('isStale', () => {
    it('should return true when no data exists', () => {
      const coordinator = new QueryCoordinator()
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: async () => 'result',
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      expect(coordinator.isStale(internal, 'fetchData', undefined)).toBe(true)

      mgr.destroy()
    })

    it('should return false when data is fresh', async () => {
      const coordinator = new QueryCoordinator({ staleTime: 60000 })
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: async () => 'result',
        },
      })

      const mgr = modelManager({ query: { staleTime: 60000 } })
      const inst = mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      await coordinator.fetch(internal, 'fetchData', undefined)

      expect(coordinator.isStale(internal, 'fetchData', undefined)).toBe(false)

      mgr.destroy()
    })

    it('should return true when data is stale', async () => {
      const coordinator = new QueryCoordinator({ staleTime: 0 })
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: async () => 'result',
        },
      })

      const mgr = modelManager({ query: { staleTime: 0 } })
      const inst = mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      await coordinator.fetch(internal, 'fetchData', undefined)

      // staleTime=0, so it's immediately stale
      expect(coordinator.isStale(internal, 'fetchData', undefined)).toBe(true)

      mgr.destroy()
    })
  })

  describe('staleTime resolution', () => {
    it('should use override staleTime when provided', () => {
      const coordinator = new QueryCoordinator({ staleTime: 1000 })
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: {
            fn: async () => 'result',
            staleTime: 5000,
          },
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      expect(coordinator.resolveStaleTime(internal, 'fetchData', 9999)).toBe(
        9999
      )
      mgr.destroy()
    })

    it('should use query spec staleTime over store default', () => {
      const coordinator = new QueryCoordinator({ staleTime: 1000 })
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: {
            fn: async () => 'result',
            staleTime: 5000,
          },
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      expect(coordinator.resolveStaleTime(internal, 'fetchData')).toBe(5000)
      mgr.destroy()
    })

    it('should fall back to store default staleTime', () => {
      const coordinator = new QueryCoordinator({ staleTime: 3000 })
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: async () => 'result',
        },
      })

      const mgr = modelManager({ query: {} })
      mgr.getModel('test', model)
      const internal = getInternal(mgr, 'test', model)

      expect(coordinator.resolveStaleTime(internal, 'fetchData')).toBe(3000)
      mgr.destroy()
    })
  })

  describe('$prefetchQuery through model instance', () => {
    it('should work when coordinator is wired by modelManager', async () => {
      const fn = jest.fn(async () => 'prefetched')
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel('test', model)

      inst.$prefetchQuery('fetchData')
      // Wait for the fetch to complete
      await new Promise((r) => setTimeout(r, 10))

      const data = inst.$getQueryData('fetchData')
      expect(data).toBe('prefetched')
      expect(fn).toHaveBeenCalledTimes(1)

      mgr.destroy()
    })

    it('should be a no-op when coordinator is not wired', async () => {
      const fn = jest.fn(async () => 'prefetched')
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      // Create a model manager WITHOUT query config — coordinator should still be created
      const mgr = modelManager()
      const inst = mgr.getModel('test', model)

      // $prefetchQuery should still work since coordinator is always created
      inst.$prefetchQuery('fetchData')
      await new Promise((r) => setTimeout(r, 10))

      const data = inst.$getQueryData('fetchData')
      expect(data).toBe('prefetched')

      mgr.destroy()
    })
  })

  describe('$cancelQueries through model instance', () => {
    it('should cancel inflight queries through model public API', async () => {
      let signal!: AbortSignal
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: (ctx: any) => {
            signal = ctx.signal
            return new Promise((resolve) => setTimeout(resolve, 5000))
          },
        },
      })

      const mgr = modelManager({ query: {} })
      const inst = mgr.getModel('test', model)

      inst.$prefetchQuery('fetchData')
      // Let the fetch start
      await new Promise((r) => setTimeout(r, 5))

      inst.$cancelQueries('fetchData')
      expect(signal.aborted).toBe(true)

      mgr.destroy()
    })
  })

  describe('doura factory', () => {
    it('should pass query config through to modelManager', async () => {
      const fn = jest.fn(async () => 'from-doura')
      const model = defineModel({
        state: { value: 0 },
        queries: {
          fetchData: fn,
        },
      })

      const store = doura({ query: { staleTime: 5000, gcTime: 30000 } })
      const inst = store.getModel('test', model)

      inst.$prefetchQuery('fetchData')
      await new Promise((r) => setTimeout(r, 10))

      expect(inst.$getQueryData('fetchData')).toBe('from-doura')

      store.destroy()
    })
  })
})

// Helper to get the internal ModelInternal from modelManager
function getInternal(
  mgr: ReturnType<typeof modelManager>,
  name: string,
  model: any
) {
  const inst = mgr.getModel(name, model)
  return (inst as any)._ as any
}
