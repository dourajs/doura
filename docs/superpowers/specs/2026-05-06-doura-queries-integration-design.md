# Doura Queries & Actions Integration Design

> Integrate doura-resource's query/mutation capabilities directly into doura core and react-doura.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Hybrid (C) | Query state in model, store-level coordinator for dedup/GC/cross-cutting |
| Query declaration | Flat `queries` field in `defineModel` | Parallel to `actions`/`views` |
| Query data storage | Default isolated, optional `setData`/`getData` | Separation by default, flexibility when needed |
| React consumption | `useQuery`/`useAction` from `useModel` return | Consistent API pattern |
| Invalidation | `this.$invalidateQueries()` + `use()` for cross-model | Leverages existing composition mechanism |
| Action state | `useAction` hook with global cache in model | Per-hook-instance ID, GC-managed, globally queryable |
| Infinite query | `useInfiniteQuery` with `initialArgs`/`getNextArgs` | Reuses existing query `fn`, no redundant config |
| Store config | `doura({ query: { gcTime, staleTime } })` | Store-level, no new store APIs |
| Plugin system | No changes | Keep existing hooks unchanged |

---

## 1. User API

### 1.1 defineModel — `queries` field

Two declaration forms: shorthand (function only) and full (object with config).

```ts
const userModel = defineModel({
  state: {
    users: {} as Record<string, User>,
  },

  actions: {
    async updateUser(payload: { id: string; name: string }) {
      await api.updateUser(payload)
      this.$invalidateQueries('fetchUser')
    },

    async deleteUser(id: string) {
      await api.deleteUser(id)
      this.$invalidateQueries()  // invalidate all queries
    },
  },

  views: {
    userCount() {
      return Object.keys(this.users).length
    },
  },

  queries: {
    // Shorthand — function only, no args
    fetchList: (ctx) =>
      fetch('/api/users').then((r) => r.json() as Promise<User[]>),

    // Shorthand — function only, with args
    fetchUser: (ctx, args: { id: string }) =>
      fetch(`/api/users/${args.id}`).then((r) => r.json() as Promise<User>),

    // Full form — with config
    fetchUserToState: {
      key: (args: { id: string }) => [args.id],
      fn: (ctx, args: { id: string }) =>
        fetch(`/api/users/${args.id}`).then((r) => r.json() as Promise<User>),
      staleTime: 5000,
      setData: (state, data, args) => {
        state.users[args.id] = data
      },
      getData: (state, args) => state.users[args.id],
    },
  },
})
```

### 1.2 React Hooks

All hooks receive bound references from `useModel`'s return value.

```tsx
import { useModel, useQuery, useAction, useInfiniteQuery, useActionState } from 'react-doura'

// 1. Get model
const [state, actions, queries] = useModel('user', userModel)

// 2. Query — with args
const { data, isLoading, error, refetch } = useQuery(
  queries.fetchUser,
  { id: '1' },
  { staleTime: 10000 }
)

// 3. Query — no args
const { data: list } = useQuery(queries.fetchList, { enabled: isReady })

// 4. Action
const { mutate, isPending } = useAction(actions.updateUser)
mutate({ id: '1', name: 'new' }, {
  onSuccess: (data) => console.log('done', data),
  onError: (err) => console.error(err),
})
// Note: mutate takes the action's first argument + optional callbacks.
// Actions are expected to have a single object parameter.

// 5. Infinite Query
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery(
  queries.fetchUsers,
  {
    initialArgs: {},
    getNextArgs: (lastPage) =>
      lastPage.nextCursor ? { cursor: lastPage.nextCursor } : undefined,
  }
)

// 6. Global action state
const pendingActions = useActionState({ status: 'pending' })
```

### 1.3 useModel return value

```ts
// Existing: [state, actions]
// New: [state, actions, queries]
const [state, actions, queries] = useModel('user', userModel)

// `queries` contains bound references for each defined query.
// `actions` contains bound references for each defined action.
// Both can be passed to useQuery / useAction respectively.
```

Existing destructuring `[state, actions]` is unaffected (third element is optional).

### 1.4 Model Public Instance — Query Methods

Available on model instances (via `useStaticModel`, inside actions via `this`, via `use()` cross-model).

```ts
// Invalidation
model.$invalidateQueries()                                 // all queries
model.$invalidateQueries('fetchUser')                      // specific query
model.$invalidateQueries('fetchUser', { id: '1' })         // specific query + args

// Read/write cache
model.$setQueryData('fetchUser', { id: '1' }, newData)
model.$getQueryData('fetchUser', { id: '1' })

// Prefetch
model.$prefetchQuery('fetchUser', { id: '1' })

// Cancel
model.$cancelQueries()                                     // all
model.$cancelQueries('fetchUser')                          // specific query
model.$cancelQueries('fetchUser', { id: '1' })             // specific instance

// Reset (clear data + error, restore to initial state)
model.$resetQueries()
model.$resetQueries('fetchUser')
model.$resetQueries('fetchUser', { id: '1' })
```

### 1.5 Cross-Model Invalidation via `use()`

```ts
const composedModel = defineModel(() => {
  const users = use('users', userModel)
  const posts = use('posts', postModel)

  return {
    state: {},
    actions: {
      async deleteUserAndPosts(userId: string) {
        await api.deleteUser(userId)
        users.$invalidateQueries('fetchUser', { id: userId })
        posts.$invalidateQueries('fetchByUser', { userId })
      },
    },
  }
})
```

### 1.6 Store Configuration

```ts
const store = doura({
  query: {
    gcTime: 5 * 60 * 1000, // default 5 min, Infinity to disable, 0 for immediate
    staleTime: 0,           // default 0 (always stale)
  },
})
```

No new imperative APIs on the store. All operations go through model instances.

---

## 2. Complete Type Definitions

### 2.1 Query Definition Types

```ts
interface QueryCtx {
  signal: AbortSignal
}

interface QuerySpec<TArgs extends object | void, TData, S extends State> {
  key?: TArgs extends void ? never : (args: TArgs) => unknown[]
  fn: TArgs extends void
    ? (ctx: QueryCtx) => Promise<TData>
    : (ctx: QueryCtx, args: TArgs) => Promise<TData>
  staleTime?: number
  setData?: TArgs extends void
    ? (state: S, data: TData) => void
    : (state: S, data: TData, args: TArgs) => void
  getData?: TArgs extends void
    ? (state: S) => TData | undefined
    : (state: S, args: TArgs) => TData | undefined
}

type QueryShorthand<TArgs extends object | void, TData> = TArgs extends void
  ? (ctx: QueryCtx) => Promise<TData>
  : (ctx: QueryCtx, args: TArgs) => Promise<TData>

type QueriesOption<S extends State> = Record<
  string,
  QuerySpec<any, any, S> | QueryShorthand<any, any>
>
```

### 2.2 defineModel Extension

```ts
interface ObjectModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  Q extends QueriesOption<S>
> {
  state: S
  actions?: A
  views?: V & ThisType<ViewThis<S, V>>
  queries?: Q
} & ThisType<ModelThis<S, A, V, Q>>

// ModelThis now includes query methods
interface ModelQueryMethods {
  $invalidateQueries(queryName?: string, args?: object): void
  $cancelQueries(queryName?: string, args?: object): void
  $resetQueries(queryName?: string, args?: object): void
  $setQueryData(queryName: string, args: object, data: unknown): void
  $getQueryData(queryName: string, args: object): unknown | undefined
  $prefetchQuery(queryName: string, args: object): Promise<void>
}
```

### 2.3 QueryDef — Bound Query Reference

Returned as part of `useModel`'s third tuple element. Contains internal binding to the model instance.

```ts
interface QueryDef<TArgs extends object | void, TData> {
  /** @internal */ readonly _brand: 'QueryDef'
  /** @internal */ readonly _model: ModelInstance
  /** @internal */ readonly _queryName: string
  /** @internal */ readonly _args: TArgs   // phantom type
  /** @internal */ readonly _data: TData   // phantom type
}
```

### 2.4 ActionDef — Bound Action Reference

Returned as part of `useModel`'s second tuple element. Callable as before, with internal binding.

```ts
interface ActionDef<TData, TArgs extends any[]> {
  (...args: TArgs): TData
  /** @internal */ readonly _brand: 'ActionDef'
  /** @internal */ readonly _model: ModelInstance
  /** @internal */ readonly _actionName: string
}
```

### 2.5 useQuery

```ts
interface UseQueryResult<TData, TSelected = TData> {
  data: TSelected | undefined
  error: unknown
  isLoading: boolean         // first load, no cached data
  isPending: boolean         // no data yet
  isFetching: boolean        // any fetch in progress
  isSuccess: boolean
  isError: boolean
  isStale: boolean
  isRefetching: boolean      // has data + fetching
  isPlaceholderData: boolean
  refetch: () => Promise<TData>
}

interface QueryOverrides<TData, TSelected = TData> {
  enabled?: boolean | (() => boolean)
  staleTime?: number
  select?: (data: TData) => TSelected
  placeholderData?: TData | ((prev?: TData) => TData | undefined)
}

// Overload: query with args
function useQuery<TArgs extends object, TData, TSelected = TData>(
  queryDef: QueryDef<TArgs, TData>,
  args: TArgs,
  options?: QueryOverrides<TData, TSelected>
): UseQueryResult<TData, TSelected>

// Overload: query without args
function useQuery<TData, TSelected = TData>(
  queryDef: QueryDef<void, TData>,
  options?: QueryOverrides<TData, TSelected>
): UseQueryResult<TData, TSelected>
```

### 2.6 useAction

```ts
interface UseActionResult<TData, TArgs extends any[]> {
  mutate: (args: TArgs[0], callbacks?: ActionCallbacks<TData>) => void
  mutateAsync: (args: TArgs[0], callbacks?: ActionCallbacks<TData>) => Promise<TData>
  data: TData | undefined
  error: unknown
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  isIdle: boolean
  reset: () => void
}

interface ActionCallbacks<TData> {
  onSuccess?: (data: TData) => void
  onError?: (error: unknown) => void
  onSettled?: (data: TData | undefined, error: unknown | null) => void
}

function useAction<TData, TArgs extends any[]>(
  actionDef: ActionDef<TData, TArgs>
): UseActionResult<TData, TArgs>
```

### 2.7 useInfiniteQuery

```ts
interface UseInfiniteQueryResult<TData> {
  data: { pages: TData[]; args: object[] } | undefined
  error: unknown
  isLoading: boolean
  isFetching: boolean
  isSuccess: boolean
  isError: boolean
  hasNextPage: boolean
  hasPreviousPage: boolean
  isFetchingNextPage: boolean
  isFetchingPreviousPage: boolean
  fetchNextPage: () => Promise<void>
  fetchPreviousPage: () => Promise<void>
  refetch: () => Promise<void>
}

interface InfiniteQueryConfig<TArgs extends object, TData> {
  initialArgs: TArgs
  getNextArgs: (lastPage: TData, allPages: TData[]) => TArgs | undefined
  getPreviousArgs?: (firstPage: TData, allPages: TData[]) => TArgs | undefined
}

function useInfiniteQuery<TArgs extends object, TData>(
  queryDef: QueryDef<TArgs, TData>,
  config: InfiniteQueryConfig<TArgs, TData>,
  options?: QueryOverrides<TData>
): UseInfiniteQueryResult<TData>
```

### 2.8 useActionState

```ts
interface ActionStateFilter {
  status?: 'idle' | 'pending' | 'success' | 'error'
  actionRef?: ActionDef<any, any>
}

function useActionState(
  filters?: ActionStateFilter
): ActionCacheEntry[]
```

---

## 3. Internal Architecture

### 3.1 Overview

```
Doura Store
├── config.query: { gcTime, staleTime }
├── QueryCoordinator (lazy-init on first query)
│   ├── FetchManager     — request deduplication
│   └── GCManager        — observer refcounting + timers (shared for queries & actions)
│
├── Model A
│   ├── state            (user-defined)
│   ├── views            (computed)
│   ├── actions          (methods)
│   ├── _queryCache      Map<QueryHash, QueryCacheEntry>
│   ├── _queryNotifiers  Map<QueryHash, Set<() => void>>
│   ├── _actionCache     Map<ActionId, ActionCacheEntry>
│   └── _actionNotifiers Map<ActionId, Set<() => void>>
│
└── Model B (same structure)
```

### 3.2 QueryCoordinator

Lives on the `Doura` store instance. Lazy-initialized when the first query-enabled model is created.

```ts
class QueryCoordinator {
  private fetchManager: FetchManager
  private gcManager: GCManager
  private config: { gcTime: number; staleTime: number }

  // Query lifecycle
  fetch(model: ModelInternal, queryName: string, args: object | void): Promise<unknown>
  cancel(model: ModelInternal, queryName: string, args?: object): void

  // GC observation (queries and actions share the same GC)
  observeQuery(hash: QueryHash): void
  unobserveQuery(hash: QueryHash, cleanup: () => void): void
  observeAction(actionId: ActionId): void
  unobserveAction(actionId: ActionId, cleanup: () => void): void
}
```

### 3.3 FetchManager

```ts
class FetchManager {
  private inflight: Map<QueryHash, {
    controller: AbortController
    promise: Promise<unknown>
  }>

  fetch(hash: QueryHash, fetcher: (signal: AbortSignal) => Promise<unknown>): Promise<unknown>
  cancel(hash: QueryHash): void
  cancelByPrefix(prefix: string): void
}
```

- Same hash in-flight: returns existing promise (deduplication).
- On cancel: aborts `AbortController`, removes entry.

### 3.4 GCManager

```ts
class GCManager {
  private refcounts: Map<string, number>
  private timers: Map<string, ReturnType<typeof setTimeout>>

  observe(key: string): void        // refcount++, cancel pending timer
  unobserve(key: string, gcTime: number, cleanup: () => void): void
                                     // refcount--, schedule cleanup if 0
}
```

Shared instance for both queries and actions.

### 3.5 Query Cache Entry

```ts
interface QueryCacheEntry {
  data: unknown
  error: unknown
  dataUpdatedAt: number         // for staleTime calculation
  fetchStatus: 'idle' | 'fetching'
}
```

### 3.6 Action Cache Entry

```ts
interface ActionCacheEntry {
  status: 'idle' | 'pending' | 'success' | 'error'
  data: unknown
  error: unknown
  submittedAt: number
  settledAt: number
}
```

### 3.7 Query Hash Computation

```ts
function computeQueryHash(
  modelName: string,
  queryName: string,
  args: object | void,
  keyFn?: (args: any) => unknown[]
): QueryHash {
  const userKey = keyFn ? keyFn(args) : args ? [stableStringify(args)] : []
  return hashQueryKey([modelName, queryName, ...userKey])
}
```

Auto-prefixed with `[modelName, queryName]` to ensure uniqueness across models.

### 3.8 ModelInternal Changes — Queries Aligned with Actions

For reference, here is how **actions** currently work in `ModelInternal`:

```
_initActions():
  - for each actionName in options.actions:
    - accessCache[actionName] = AccessTypes.ACTION
    - this.actions[actionName] = wrappedFn (manages actionDepth, listeners, sync flush)
  - this.actions is frozen

Proxy access:
  - accessCache hit → return this.actions[key]
  - PublicProxy: same, returns bound action
  - $actions → returns this.actions object
```

**Queries** follow the same pattern:

```
_initQueries():
  - for each queryName in options.queries:
    - accessCache[queryName] = AccessTypes.QUERY
    - normalize shorthand (function → { fn }) 
    - this.queries[queryName] = normalizedSpec (frozen query definition)
  - this.queries is frozen

Proxy access:
  - accessCache hit → return this.queries[key] (the spec, not execution result)
  - PublicProxy: same
  - $queries → returns this.queries object
```

**Full ModelInternal structure (new members):**

```ts
class ModelInternal {
  // Existing
  state: Draft
  actions: Record<string, Function>
  views: Record<string, ViewImpl>
  accessCache: Record<string, AccessTypes>

  // New — query definitions (parallel to this.actions)
  queries: Record<string, NormalizedQuerySpec>  // frozen, set during _initQueries()

  // New — query runtime cache (isolated from user state)
  _queryCache: Map<QueryHash, QueryCacheEntry>
  _queryNotifiers: Map<QueryHash, Set<() => void>>

  // New — action execution cache (for useAction state tracking)
  _actionCache: Map<ActionId, ActionCacheEntry>
  _actionNotifiers: Map<ActionId, Set<() => void>>

  // New — query cache subscription methods
  _subscribeQuery(hash: QueryHash, cb: () => void): () => void
  _getQueryState(hash: QueryHash): QueryCacheEntry | undefined
  _setQueryState(hash: QueryHash, partial: Partial<QueryCacheEntry>): void
  _removeQuery(hash: QueryHash): void

  // New — action cache subscription methods
  _subscribeAction(id: ActionId, cb: () => void): () => void
  _getActionState(id: ActionId): ActionCacheEntry | undefined
  _setActionState(id: ActionId, partial: Partial<ActionCacheEntry>): void
  _removeAction(id: ActionId): void

  // New — public API methods (registered in publicPropertiesMap)
  $invalidateQueries(queryName?: string, args?: object): void
  $setQueryData(queryName: string, args: object, data: unknown): void
  $getQueryData(queryName: string, args: object): unknown | undefined
  $prefetchQuery(queryName: string, args: object): Promise<void>
  $cancelQueries(queryName?: string, args?: object): void
  $resetQueries(queryName?: string, args?: object): void
}
```

**AccessTypes enum extension:**

```ts
enum AccessTypes {
  STATE,
  ACTION,
  VIEW,
  CONTEXT,
  QUERY,    // new
}
```

**Proxy GET resolution order (updated):**

1. Check `accessCache[key]` — if hit, dispatch to STATE / ACTION / VIEW / QUERY / CONTEXT
2. If `hasOwn(state, key)` → cache as STATE
3. If `hasOwn(queries, key)` → cache as QUERY, return `this.queries[key]`
4. If `hasOwn(ctx, key)` → cache as CONTEXT

**publicPropertiesMap additions:**

```ts
$queries: (i) => i.queries                    // all query specs
$invalidateQueries: (i) => i.$invalidateQueries.bind(i)
$setQueryData: (i) => i.$setQueryData.bind(i)
$getQueryData: (i) => i.$getQueryData.bind(i)
$prefetchQuery: (i) => i.$prefetchQuery.bind(i)
$cancelQueries: (i) => i.$cancelQueries.bind(i)
$resetQueries: (i) => i.$resetQueries.bind(i)
```

### 3.9 defineModel Changes

`defineModel` remains a near-identity function. It normalizes query shorthands into full specs but does NOT create bound `QueryDef` objects — those require a live model instance.

**Stage 1 — `defineModel` (definition time):**

```ts
function defineModel(options) {
  // Existing logic unchanged

  if (options.queries) {
    options._queryDefs = {}
    for (const [name, spec] of Object.entries(options.queries)) {
      // Normalize shorthand (function) to full spec (object)
      options._queryDefs[name] = typeof spec === 'function' ? { fn: spec } : spec
    }
  }

  return options
}
```

**Stage 2 — `useModel` (runtime, React hook):**

When `useModel` returns the third tuple element `queries`, it creates bound `QueryDef` objects that reference the live model instance:

```ts
// Inside createUseModel, when building the queries tuple element:
const queries = {}
for (const name of Object.keys(modelDef._queryDefs)) {
  queries[name] = {
    _brand: 'QueryDef',
    _model: modelInstance,
    _queryName: name,
    _spec: modelDef._queryDefs[name],
  }
}
```

This two-stage approach keeps `defineModel` lightweight and avoids circular dependencies between model definitions and model instances.

### 3.10 React Hook Internal Flow

**useQuery:**

```
useQuery(queries.fetchUser, { id: '1' }, options?)
  │
  ├─ 1. Extract modelInstance, queryName from bound QueryDef
  ├─ 2. Compute queryHash from (modelName, queryName, args, keyFn)
  ├─ 3. useSyncExternalStore(
  │       subscribe: model._subscribeQuery(hash),
  │       getSnapshot: model._getQueryState(hash)
  │     )
  ├─ 4. useEffect:
  │     ├─ coordinator.observeQuery(hash)
  │     ├─ if (enabled && isStale) → coordinator.fetch(model, queryName, args)
  │     └─ cleanup: coordinator.unobserveQuery(hash, () => model._removeQuery(hash))
  └─ 5. Return derived state { data, isLoading, isFetching, ... }
```

**useAction:**

```
useAction(actions.updateUser)
  │
  ├─ 1. Extract modelInstance, actionName from bound ActionDef
  ├─ 2. Generate unique actionId (per hook instance)
  ├─ 3. useSyncExternalStore(
  │       subscribe: model._subscribeAction(actionId),
  │       getSnapshot: model._getActionState(actionId)
  │     )
  ├─ 4. useEffect:
  │     ├─ coordinator.observeAction(actionId)
  │     └─ cleanup: coordinator.unobserveAction(actionId, () => model._removeAction(actionId))
  ├─ 5. mutateAsync:
  │     ├─ model._setActionState(actionId, { status: 'pending' })
  │     ├─ await actionRef(...args)
  │     ├─ model._setActionState(actionId, { status: 'success', data })
  │     └─ on error: model._setActionState(actionId, { status: 'error', error })
  └─ 6. Return { mutate, mutateAsync, data, isPending, ... }
```

**useInfiniteQuery:**

```
useInfiniteQuery(queries.fetchUsers, config, options?)
  │
  ├─ 1. Compute root hash from (modelName, queryName, config.initialArgs)
  ├─ 2. Track page args in model query cache: _queryPageArgs[rootHash]
  ├─ 3. On mount: fetch first page with config.initialArgs
  ├─ 4. fetchNextPage:
  │     ├─ getNextArgs(lastPage, allPages)
  │     ├─ if undefined → hasNextPage = false
  │     └─ else → fetch with next args, append to pages
  ├─ 5. fetchPreviousPage: symmetric to fetchNextPage
  └─ 6. Return { data: { pages, args }, hasNextPage, fetchNextPage, ... }
```

---

## 4. Stale Time Resolution

Three levels, highest specificity wins:

1. `QueryOverrides.staleTime` (per-use in `useQuery`)
2. `QuerySpec.staleTime` (per-query in model definition)
3. `store.query.staleTime` (global default)

---

## 5. Test Coverage

All scenarios from doura-resource must be covered. Organized by area:

### 5.1 Query Definition (`defineModel` with queries)
- Shorthand (function) normalization to full spec
- Full spec with key, staleTime, setData, getData
- Query name conflict detection (vs state/actions/views keys)
- QueryDef phantom type inference

### 5.2 Query Execution
- Basic fetch and data storage
- Isolated storage (default) — data in `_queryCache`
- Custom storage via setData/getData — data written to model state
- Request deduplication (concurrent useQuery for same hash)
- AbortSignal cancellation
- Error handling and error state
- Stale time resolution (3 levels)
- Refetch on stale

### 5.3 Query Cache Operations
- `$invalidateQueries()` — all, by name, by name + args
- `$setQueryData` / `$getQueryData` — manual cache read/write
- `$prefetchQuery` — fetch without subscription
- `$cancelQueries` — abort inflight
- `$resetQueries` — clear data + error

### 5.4 Cross-Model Invalidation
- Invalidation via `use()` composed models
- `users.$invalidateQueries('fetchUser')` from composed action

### 5.5 GC
- Query GC: unobserve → timer → cleanup
- Action GC: unobserve → timer → cleanup
- Re-observe cancels pending GC timer
- No unbounded memory growth under high-volume lifecycle

### 5.6 React: useQuery
- Data fetching and rendering
- `enabled: false` skips fetch
- `select` transform
- `placeholderData`
- `staleTime` override
- `refetch()`
- StrictMode compatibility
- Render isolation (unrelated query changes don't re-render)

### 5.7 React: useAction
- `mutate` / `mutateAsync` execution
- Status transitions: idle → pending → success/error
- `onSuccess` / `onError` / `onSettled` callbacks
- `reset()` restores idle
- Per-instance state isolation
- Global state via `useActionState`

### 5.8 React: useInfiniteQuery
- Initial page fetch
- `fetchNextPage` accumulates pages
- `fetchPreviousPage`
- `hasNextPage` / `hasPreviousPage` derived from getNextArgs/getPreviousArgs
- Page args tracking

### 5.9 React: useModel queries integration
- Third tuple element contains bound QueryDefs
- Compatible with existing `[state, actions]` destructuring

### 5.10 Store Configuration
- Default gcTime/staleTime
- Custom gcTime/staleTime
- Lazy coordinator initialization

### 5.11 Type-Level Tests
- QueryDef generic inference (TArgs, TData)
- useQuery overload resolution (with/without args)
- useAction generic inference
- useInfiniteQuery generic inference
- Model public instance method types ($invalidateQueries etc.)
