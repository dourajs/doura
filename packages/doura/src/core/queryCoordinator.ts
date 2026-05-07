import { FetchManager } from './fetchManager'
import { GCManager } from './gcManager'
import { QueryConfig, DEFAULT_QUERY_CONFIG, QueryHash } from './queryTypes'
import type { ModelInternal } from './model'

export class QueryCoordinator {
  private _fetchManager: FetchManager
  private _gcManager: GCManager
  private _config: QueryConfig
  private _appliedInflight = new Map<QueryHash, Promise<unknown>>()

  constructor(config?: Partial<QueryConfig>) {
    this._config = { ...DEFAULT_QUERY_CONFIG, ...config }
    this._fetchManager = new FetchManager()
    this._gcManager = new GCManager()
  }

  get config(): QueryConfig {
    return this._config
  }

  async fetch(
    model: ModelInternal,
    queryName: string,
    args: object | void
  ): Promise<unknown> {
    const handle = model.queries[queryName]
    if (!handle) {
      throw new Error(`Query "${queryName}" not found on model "${model.name}"`)
    }
    const fn = handle._spec.fn

    const hash = handle.computeHash(args as any)
    const shared = this._appliedInflight.get(hash)
    if (shared) {
      return shared
    }

    const existing = model.getQueryState(queryName, args)
    model.setQueryState(queryName, args, {
      data: existing?.data,
      error: undefined,
      dataUpdatedAt: existing?.dataUpdatedAt || 0,
      fetchStatus: 'fetching',
    })

    const appliedPromise = this._fetchManager
      .fetch(hash, (signal) => {
        const ctx = { signal }
        return args !== undefined
          ? (fn as Function)(ctx, args)
          : (fn as Function)(ctx)
      })
      .promise.then((result) => {
        if (!model.destroyed) {
          model.setQueryData(queryName, args, result)
        }
        return result
      })
      .catch((error) => {
        if (!model.destroyed) {
          const prev = model.getQueryState(queryName, args)
          const aborted = (error as any)?.name === 'AbortError'
          model.setQueryState(queryName, args, {
            data: prev?.data,
            error: aborted ? undefined : error,
            dataUpdatedAt: prev?.dataUpdatedAt || 0,
            fetchStatus: 'idle',
          })
        }
        throw error
      })
      .finally(() => {
        this._appliedInflight.delete(hash)
      })

    this._appliedInflight.set(hash, appliedPromise)
    return appliedPromise
  }

  cancel(model: ModelInternal, queryName?: string, args?: object | void): void {
    if (!queryName) {
      this._fetchManager.cancelByPrefix(model.queryHashPrefix())
      return
    }

    const handle = model.queries[queryName]
    if (!handle) {
      return
    }

    if (args !== undefined) {
      const hash = handle.computeHash(args as any)
      this._fetchManager.cancel(hash)
      return
    }
    this._fetchManager.cancelByPrefix(model.queryHashPrefix(queryName))
  }

  resolveStaleTime(
    model: ModelInternal,
    queryName: string,
    overrideStaleTime?: number
  ): number {
    if (overrideStaleTime !== undefined) return overrideStaleTime
    const handle = model.queries[queryName]
    const staleTime = handle?._spec.staleTime
    if (staleTime !== undefined) return staleTime
    return this._config.staleTime
  }

  isStale(
    model: ModelInternal,
    queryName: string,
    args: object | void,
    overrideStaleTime?: number
  ): boolean {
    const entry = model.getQueryState(queryName, args)
    if (!entry || entry.data === undefined) return true
    const staleTime = this.resolveStaleTime(model, queryName, overrideStaleTime)
    return Date.now() - entry.dataUpdatedAt >= staleTime
  }

  // GC
  observeQuery(hash: QueryHash): void {
    this._gcManager.observe(hash as string)
  }

  unobserveQuery(hash: QueryHash, cleanup: () => void): void {
    this._gcManager.unobserve(hash as string, this._config.gcTime, cleanup)
  }

  destroy(): void {
    this._appliedInflight.clear()
    this._fetchManager.destroy()
    this._gcManager.destroy()
  }
}
