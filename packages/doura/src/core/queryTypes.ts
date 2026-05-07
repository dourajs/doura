// packages/doura/src/core/queryTypes.ts

export type QueryHash = string & { __brand: 'QueryHash' }

export interface QueryCtx {
  signal: AbortSignal
}

export interface OnDataCtx<S = any, TArgs extends object | void = any> {
  state: S
  args: TArgs
}

/** Full query spec — used when the user writes an object literal under
 *  `queries`. `fn` is the sole authoritative position: TS infers TArgs
 *  from its second parameter and TData from its return type. Every
 *  other callback (key / onData) wraps TArgs / TData in
 *  `NoInfer<...>` so they receive fn's inferred types via contextual
 *  typing but do NOT themselves drive inference — the user declares
 *  `args: {...}` exactly once, inside fn.
 *
 *  `fn` always has the 2-param shape `(ctx, args: TArgs) => Promise<TData>`.
 *  When the user writes a 1-param fn (no args), TArgs defaults to `void`.
 *  The `[TArgs] extends [void]` guard on the other callbacks prevents
 *  distributive conditionals so the branch is evaluated AFTER inference
 *  resolves TArgs.
 *
 *  Per-entry inference (each queries entry gets its own TArgs / TData
 *  context) is arranged by `defineModel` via a `const Q extends ...`
 *  type parameter plus a self-referential mapped-type constraint.
 *  `const` (TS 5.0+) keeps Q's literal shape narrow; the mapped
 *  constraint validates each entry against `InferQueryEntry<Q[K], S>`. */
export interface QuerySpec<
  TArgs extends object | void = any,
  TData = any,
  S = any,
> {
  key?: TArgs extends void
    ? () => unknown[]
    : (args: NoInfer<TArgs>) => unknown[]
  fn: TArgs extends void
    ? (ctx: QueryCtx) => Promise<TData>
    : (ctx: QueryCtx, args: TArgs) => Promise<TData>
  staleTime?: number
  onData?: (ctx: OnDataCtx<S, NoInfer<TArgs>>, data: NoInfer<TData>) => void
}

export type QueryShorthand<
  TArgs extends object | void = any,
  TData = any,
> = TArgs extends void
  ? (ctx: QueryCtx) => Promise<TData>
  : (ctx: QueryCtx, args: TArgs) => Promise<TData>

/** Normalized internal form — fn always 2-param, key always present
 *  (populated by defineModel). No NoInfer here; consumers of this type
 *  work with already-resolved concrete types. */
export interface NormalizedQuerySpec<
  TArgs extends object | void = any,
  TData = any,
  S = any,
> {
  key?: (args: TArgs) => unknown[]
  fn: TArgs extends void
    ? (ctx: QueryCtx) => Promise<TData>
    : (ctx: QueryCtx, args: TArgs) => Promise<TData>
  staleTime?: number
  onData?: (ctx: OnDataCtx<S, TArgs>, data: TData) => void
}

/** Per-entry inference shape used inside `defineModel`'s queries-field
 *  constraint. TS does not re-infer per entry when `queries` is typed
 *  against `Record<string, QuerySpec<any, any, S>>` — all entries
 *  collapse onto the same `TArgs = any, TData = any` context. The
 *  self-referential mapped-type constraint
 *    `Q extends { [K in keyof Q]: InferQueryEntry<Q[K], S> }`
 *  forces TS to re-evaluate each entry in its own context, which lets
 *  the NoInfer-wrapped fields inside `QuerySpec` pick up fn's inferred
 *  TArgs / TData for that specific entry. */
export type InferQueryEntry<E, S> = E extends (
  ctx: QueryCtx,
  ...args: any[]
) => Promise<any>
  ? E // shorthand — accept as-is
  : E extends { fn: (ctx: QueryCtx, args: infer A) => Promise<infer D> }
    ? QuerySpec<A extends object ? A : void, D, S>
    : E extends { fn: (ctx: QueryCtx) => Promise<infer D> }
      ? QuerySpec<void, D, S>
      : never

export type QueriesOption<S = any> = Record<
  string,
  QuerySpec<any, any, S> | ((ctx: QueryCtx, ...args: any[]) => Promise<any>)
>

// -----------------------------------------------------------------------------
// query — fn-driven spec helper
// -----------------------------------------------------------------------------
//
// Users write `args: TArgs` annotation ONCE inside `fn`, and every
// other callback (key / onData) gets its parameters
// contextually typed with the inferred types — no generics, no
// per-callback annotation.
//
//   queries: {
//     fetchUser: query({
//       fn: (ctx, args: { id: string }) => api.getUser(args.id),
//       key: (args) => [args.id],                // args: { id: string }
//       onData: ({ state, args }, data) => {
//         state.users[args.id] = data
//       },
//     }),
//   }
//
// Why a helper is necessary: inside `defineModel`, the queries field
// is typed against `QueriesOption<S>`, which uses `QuerySpec<any,any,S>`.
// That means inner callbacks on a bare object literal get contextually
// typed against `any`-widened TArgs / TData — NoInfer can't fire
// because the generics never get a chance to be inferred from fn first.
// `query(...)` establishes a FRESH inference context scoped to that one
// entry: TS infers TArgs from `fn`'s second parameter and TData from
// its return type, then NoInfer on the other fields lets them pick up
// those inferred types through contextual typing.
//
// TS 5.4+ native `NoInfer` is used throughout.
// The helper's spec shape intentionally has a NON-CONDITIONAL `fn`
// (`(ctx, args: TArgs) => Promise<TData>`): TS infers TArgs and TData
// directly from a concrete position, no conditional branch to resolve
// first. A 1-param user fn (`(ctx) => ...`) is still accepted because
// a 1-param function is assignable to the 2-param signature; TArgs
// falls back to its `void` default in that case.
interface QueryHelperSpec<
  TArgs extends object | void = void,
  TData = unknown,
  S = any,
> {
  fn: (ctx: QueryCtx, args: TArgs) => Promise<TData>
  staleTime?: number
  key?: [TArgs] extends [void]
    ? () => unknown[]
    : (args: NoInfer<TArgs>) => unknown[]
  onData?: (ctx: OnDataCtx<S, NoInfer<TArgs>>, data: NoInfer<TData>) => void
}

export function query<
  TArgs extends object | void = void,
  TData = unknown,
  S = any,
>(spec: QueryHelperSpec<TArgs, TData, S>): QueryHelperSpec<TArgs, TData, S> {
  return spec
}

/** Coordinator interface — breaks the circular import between model.ts
 *  and queryCoordinator.ts. ModelInternal depends only on this interface;
 *  the concrete QueryCoordinator implements it. */
export interface IQueryCoordinator {
  readonly config: QueryConfig
  fetch(model: any, queryName: string, args: object | void): Promise<unknown>
  cancel(model: any, queryName?: string, args?: object | void): void
  resolveStaleTime(
    model: any,
    queryName: string,
    overrideStaleTime?: number
  ): number
  isStale(
    model: any,
    queryName: string,
    args: object | void,
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

/** Tuple of the args parameter for query handle methods that need to target
 *  a specific cache slot — empty when TArgs is void, required otherwise. */
type QueryArgsParam<TArgs> = TArgs extends void ? [] : [args: TArgs]

/** Tuple of the args parameter for bulk handle methods (invalidate/reset) —
 *  empty when TArgs is void; optional otherwise, so the caller can target
 *  either one slot (args provided) or every slot of the query (no args). */
type QueryArgsOptional<TArgs> = TArgs extends void ? [] : [args?: TArgs]

/** Bound query handle — combines model+query identity (for hooks) with
 *  runtime methods (for model-level code in actions/views/composed models).
 *
 *  One object per (model instance, query name). The same reference is:
 *   - consumed by React hooks via _model / _queryName / _spec
 *   - called by actions/views via getData/getState/isFetching/fetch/etc. */
export interface QueryHandle<TArgs extends object | void = any, TData = any> {
  // --- descriptor (used by hooks) ---
  readonly _model: any // ModelPublicInstance — typed as any to avoid circular import
  readonly _queryName: string
  readonly _spec: NormalizedQuerySpec<any, any, any>
  /** Runtime discriminator: true when the query's fn takes args (TArgs != void). */
  readonly _hasArgs: boolean
  // Phantom types for inference
  readonly _args?: TArgs
  readonly _data?: TData

  // --- runtime accessors (used by model-level code) ---
  /** Read cached data without triggering a fetch. Returns undefined if absent. */
  getData(...args: QueryArgsParam<TArgs>): TData | undefined
  /** Read the raw cache entry (data, error, fetchStatus, dataUpdatedAt). */
  getState(...args: QueryArgsParam<TArgs>): QueryCacheEntry | undefined
  /** True if the query is currently fetching. */
  isFetching(...args: QueryArgsParam<TArgs>): boolean
  /** True if the cached data is missing or older than staleTime. */
  isStale(...args: QueryArgsParam<TArgs>): boolean

  // --- runtime operations ---
  /** Kick off a fetch and resolve with the result (or reject on error). */
  fetch(...args: QueryArgsParam<TArgs>): Promise<TData>
  /** Mark the cached entry (specific args) or every entry of this query
   *  (no args) stale without clearing data. */
  invalidate(...args: QueryArgsOptional<TArgs>): void
  /** Clear the cached entry (specific args) or every entry of this query
   *  (no args) entirely. */
  reset(...args: QueryArgsOptional<TArgs>): void
  /** Write data into the cache. For args-queries the args come first; for
   *  void queries the single parameter is the data. */
  setData: TArgs extends void
    ? (data: TData) => void
    : (args: TArgs, data: TData) => void

  // --- hook integration (used by useQuery / useInfiniteQuery) ---
  /** Compute the stable cache hash for a given args value. */
  computeHash(...args: QueryArgsParam<TArgs>): QueryHash
  /** Subscribe to cache changes for a specific args slot. Returns unsubscribe. */
  subscribe(
    args: TArgs extends void ? void : TArgs,
    listener: () => void
  ): () => void
  /** Register a GC observer for the given args slot. */
  observe(...args: QueryArgsParam<TArgs>): void
  /** Unregister a GC observer. cleanup is called when gcTime elapses. */
  unobserve(args: TArgs extends void ? void : TArgs, cleanup: () => void): void
}
