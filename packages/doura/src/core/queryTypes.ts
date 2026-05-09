export type QueryHash = string & { __brand: 'QueryHash' }

export interface QueryCtx {
  signal: AbortSignal
}

type QueryArgsTuple = readonly unknown[]

export interface OnDataCtx<S = any, TArgs extends QueryArgsTuple = any[]> {
  state: S
  args: TArgs
}

/** Coordinator interface — breaks the circular import between model.ts
 *  and queryCoordinator.ts. ModelInternal depends only on this interface;
 *  the concrete QueryCoordinator implements it. */
export interface IQueryCoordinator {
  readonly config: QueryConfig
  fetch(
    model: any,
    queryName: string,
    args: readonly unknown[]
  ): Promise<unknown>
  cancel(model: any, queryName?: string, args?: readonly unknown[]): void
  resolveStaleTime(
    model: any,
    queryName: string,
    overrideStaleTime?: number
  ): number
  isStale(
    model: any,
    queryName: string,
    args: readonly unknown[],
    overrideStaleTime?: number
  ): boolean
  observeQuery(hash: QueryHash): void
  unobserveQuery(hash: QueryHash, cleanup: () => void): void
  destroy(): void
}

export type FetchStatus = 'idle' | 'fetching'

export interface QueryCacheEntry {
  data: unknown
  error: unknown
  dataUpdatedAt: number
  fetchStatus: FetchStatus
}

export interface QueryConfig {
  gcTime: number
  staleTime: number
}

export const DEFAULT_QUERY_CONFIG: QueryConfig = {
  gcTime: 5 * 60 * 1000,
  staleTime: 0,
}

type MutableTuple<T extends QueryArgsTuple> = [...T]

/** Tuple of the args parameter for bulk handle methods (invalidate/reset/cancel) —
 *  empty to target every slot, or the query args tuple to target one slot. */
type QueryArgsOptional<TArgs extends QueryArgsTuple> = [] | MutableTuple<TArgs>

/** Public bound query handle — runtime methods available to users in
 *  model instances, actions/views, and React integration types.
 *
 *  Internal identity/protocol fields live on the runtime object, but are
 *  intentionally omitted from this public type. */
export interface QueryHandle<
  TArgs extends QueryArgsTuple = any[],
  TData = any,
> {
  /** Read cached data without triggering a fetch. Returns undefined if absent. */
  getData(...args: MutableTuple<TArgs>): TData | undefined
  /** Read the raw cache entry (data, error, fetchStatus, dataUpdatedAt). */
  getState(...args: MutableTuple<TArgs>): QueryCacheEntry | undefined
  /** True if the query is currently fetching. */
  isFetching(...args: MutableTuple<TArgs>): boolean
  /** True if the cached data is missing or older than staleTime. */
  isStale(...args: MutableTuple<TArgs>): boolean

  // --- runtime operations ---
  /** Kick off a fetch and resolve with the result (or reject on error). */
  fetch(...args: MutableTuple<TArgs>): Promise<TData>
  /** Kick off a fetch and resolve when the cache has been warmed. */
  prefetch(...args: MutableTuple<TArgs>): Promise<void>
  /** Cancel the inflight request for a specific args slot, or every inflight
   *  request of this query (no args). */
  cancel(...args: QueryArgsOptional<TArgs>): void
  /** Mark the cached entry (specific args) or every entry of this query
   *  (no args) stale without clearing data. */
  invalidate(...args: QueryArgsOptional<TArgs>): void
  /** Clear the cached entry (specific args) or every entry of this query
   *  (no args) entirely. */
  reset(...args: QueryArgsOptional<TArgs>): void
  /** Write data into the cache. For args-queries the args come first; for
   *  no-arg queries the single parameter is the data. */
  setData: TArgs extends []
    ? (data: TData) => void
    : (...args: [...MutableTuple<TArgs>, data: TData]) => void
}
