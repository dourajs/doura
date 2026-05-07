import { FetchManager } from './fetchManager'
import { GCManager } from './gcManager'
import { QueryConfig, DEFAULT_QUERY_CONFIG, QueryHash } from './queryTypes'
import { computeQueryHash, computeArgsKey } from './queryUtils'
import type { ModelInternal } from './model'

export class QueryCoordinator {
  private _fetchManager: FetchManager
  private _gcManager: GCManager
  private _config: QueryConfig

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

    const hash = computeQueryHash(
      model.name,
      queryName,
      computeArgsKey(args, model.queries[queryName]?._spec.key)
    )
    model.setQueryState(queryName, args, {
      data: model.getQueryState(queryName, args)?.data,
      error: undefined,
      dataUpdatedAt: model.getQueryState(queryName, args)?.dataUpdatedAt || 0,
      fetchStatus: 'fetching',
    })

    try {
      const result = await this._fetchManager.fetch(hash, (signal) => {
        const ctx = { signal }
        return args !== undefined
          ? (fn as Function)(ctx, args)
          : (fn as Function)(ctx)
      })

      model.setQueryData(queryName, args, result)
      return result
    } catch (error) {
      if ((error as any)?.name !== 'AbortError') {
        model.setQueryState(queryName, args, {
          data: model.getQueryState(queryName, args)?.data,
          error,
          dataUpdatedAt:
            model.getQueryState(queryName, args)?.dataUpdatedAt || 0,
          fetchStatus: 'idle',
        })
      }
      throw error
    }
  }

  cancel(model: ModelInternal, queryName?: string, args?: object | void): void {
    if (!queryName) {
      this._fetchManager.cancelByPrefix(`["${model.name}"`)
      return
    }
    if (args !== undefined) {
      const hash = computeQueryHash(
        model.name,
        queryName,
        computeArgsKey(args, model.queries[queryName]?._spec.key)
      )
      this._fetchManager.cancel(hash)
      return
    }
    this._fetchManager.cancelByPrefix(`["${model.name}","${queryName}"`)
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
    this._gcManager.destroy()
  }
}
