import { emptyArray } from '../utils'
import { FetchManager } from './fetchManager'
import { GCManager } from './gcManager'
import { QueryConfig, DEFAULT_QUERY_CONFIG, QueryHash } from './queryTypes'
import { QueryHashIndex, QueryHashPrefixKey } from './queryHashIndex'
import type { ModelInternal } from './model'

export class QueryCoordinator {
  private _fetchManager: FetchManager
  private _gcManager: GCManager
  private _config: QueryConfig
  private _appliedInflight = new QueryHashIndex<Promise<unknown>>()

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
    args: readonly unknown[] = emptyArray
  ): Promise<unknown> {
    const handle = model.queries[queryName]
    if (!handle) {
      throw new Error(`Query "${queryName}" not found on model "${model.name}"`)
    }
    const fn = handle._spec.fn

    const argsTuple = args
    const hash = handle.computeHash(...(argsTuple as any[]))
    const shared = this._appliedInflight.get(hash)
    if (shared) {
      return shared.data
    }

    const existing = model.getQueryState(queryName, argsTuple)
    model.setQueryState(queryName, argsTuple, {
      data: existing?.data,
      error: undefined,
      dataUpdatedAt: existing?.dataUpdatedAt || 0,
      fetchStatus: 'fetching',
    })

    const appliedPromise = this._fetchManager
      .fetch(hash, (signal) => {
        const ctx = { signal }
        return (fn as Function)(ctx, ...argsTuple)
      })
      .then((result) => {
        if (!model.destroyed) {
          model.setQueryData(queryName, argsTuple, result, 'idle')
        }
        return result
      })
      .catch((error) => {
        if (!model.destroyed) {
          const prev = model.getQueryState(queryName, argsTuple)
          const aborted = (error as any)?.name === 'AbortError'
          model.setQueryState(queryName, argsTuple, {
            data: prev?.data,
            error: aborted ? undefined : error,
            dataUpdatedAt: prev?.dataUpdatedAt || 0,
            fetchStatus: 'idle',
          })
        }
        throw error
      })
      .finally(() => {
        this._appliedInflight.deleteHash(hash)
      })

    this._appliedInflight.set(hash, {
      scope: model.queryHashScope,
      queryName,
      data: appliedPromise,
    })
    return appliedPromise
  }

  cancel(
    model: ModelInternal,
    queryName?: string,
    args?: readonly unknown[]
  ): void {
    if (!queryName) {
      this._fetchManager.cancelMany(
        this._appliedInflight.find(this._prefixKey(model.queryHashScope))
      )
      return
    }

    const handle = model.queries[queryName]
    if (!handle) {
      return
    }

    if (args !== undefined && args.length > 0) {
      this._fetchManager.cancel(handle.computeHash(...(args as any[])))
      return
    }

    this._fetchManager.cancelMany(
      this._appliedInflight.find(
        this._prefixKey(model.queryHashScope, queryName)
      )
    )
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
    args: readonly unknown[] = emptyArray,
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

  private _prefixKey(scope: string, queryName?: string): QueryHashPrefixKey {
    return queryName === undefined ? [scope] : [scope, queryName]
  }

  destroy(): void {
    this._appliedInflight.clear()
    this._fetchManager.destroy()
    this._gcManager.destroy()
  }
}
