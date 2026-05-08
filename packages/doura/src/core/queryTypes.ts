export type QueryHash = string & { __brand: 'QueryHash' }

export interface QueryCtx {
  signal: AbortSignal
}

type QueryArgsTuple = readonly unknown[]

type QueryStaleTime<S> = S extends never ? never : number

type RemovedQueryOptions = {
  key?: never
  onData?: never
  setData?: never
  getData?: never
}

/** Full query spec — used when the user writes an object literal under
 *  `queries`. `fn` is the sole authoritative position: TS infers TArgs
 *  from its rest parameters and TData from its return type.
 *
 *  `fn` always has the shape `(ctx, ...args) => Promise<TData>`.
 *  No-args queries infer `TArgs = []`; parameterized queries infer the
 *  runtime tuple exactly, e.g. `[id: string]` or `[orgId: string, page: number]`.
 *
 *  Per-entry inference (each queries entry gets its own TArgs / TData
 *  context) is arranged by `defineModel` via a `const Q extends ...`
 *  type parameter plus a self-referential mapped-type constraint. */
export interface QuerySpec<
  TArgs extends QueryArgsTuple = any[],
  TData = any,
  S = any,
  TThis = any,
> extends RemovedQueryOptions {
  fn: (this: TThis, ctx: QueryCtx, ...args: TArgs) => Promise<TData>
  staleTime?: QueryStaleTime<S>
}

export type QueryShorthand<
  TArgs extends QueryArgsTuple = any[],
  TData = any,
  TThis = any,
> = (this: TThis, ctx: QueryCtx, ...args: TArgs) => Promise<TData>

/** Normalized internal form — only supported query options survive. */
export interface NormalizedQuerySpec<
  TArgs extends QueryArgsTuple = any[],
  TData = any,
> {
  fn: (ctx: QueryCtx, ...args: TArgs) => Promise<TData>
  staleTime?: number
}

/** Per-entry inference shape used inside `defineModel`'s queries-field
 *  constraint. The self-referential mapped-type constraint
 *    `Q extends { [K in keyof Q]: InferQueryEntry<Q[K], S, TThis> }`
 *  forces TS to validate each entry against the tuple/data inferred
 *  from that entry's own `fn`. */
export type InferQueryEntry<E, S = any, TThis = any> = E extends (
  this: any,
  ctx: QueryCtx,
  ...args: any[]
) => Promise<any>
  ? E // shorthand — accept as-is
  : E extends {
        fn: (this: any, ctx: QueryCtx, ...args: infer A) => Promise<infer D>
      }
    ? QuerySpec<A, D, S, TThis>
    : never

export type QueriesOption<S = any, TThis = any> = Record<
  string,
  QuerySpec<any[], any, S, TThis> | QueryShorthand<any[], any, TThis>
>

// -----------------------------------------------------------------------------
// query — fn-driven spec helper
// -----------------------------------------------------------------------------
//
// Users write query arguments directly in `fn`:
//
//   fetchUser: query({
//     fn: async function (ctx, id: string) {
//       const user = await api.getUser(id)
//       this.users[id] = user
//       return user
//     },
//   })
//
// Why a helper is useful: `query(...)` establishes a FRESH inference
// context scoped to one entry. TS infers TArgs from `fn`'s rest
// parameters and TData from its return type while still checking that
// removed options such as `key` and `onData` are not present.
//
// TS 5.4+ native `NoInfer` is used throughout.
// The helper's spec shape intentionally has a NON-CONDITIONAL `fn`
// (`(ctx, ...args: TArgs) => Promise<TData>`): TS infers TArgs and
// TData directly from a concrete position, no conditional branch to
// resolve first. A 1-param user fn (`(ctx) => ...`) infers `TArgs = []`.
interface QueryHelperSpec<
  TArgs extends QueryArgsTuple = [],
  TData = unknown,
  S = any,
  TThis = any,
> extends RemovedQueryOptions {
  fn: (this: TThis, ctx: QueryCtx, ...args: TArgs) => Promise<TData>
  staleTime?: QueryStaleTime<S>
}

export function query<
  TArgs extends QueryArgsTuple = [],
  TData = unknown,
  S = any,
  TThis = any,
>(
  spec: QueryHelperSpec<TArgs, TData, S, TThis>
): QueryHelperSpec<TArgs, TData, S, TThis> {
  return spec
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
