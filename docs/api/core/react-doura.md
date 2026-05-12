---
id: react-doura
title: React Doura
---

## DouraRoot

Provider context for `useModel` and `useStaticModel`. Creates and manages a global store automatically.

:::info
In development mode (`__DEV__`), `DouraRoot` automatically enables the `devtool` plugin, which connects to the [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools) for state inspection and action tracking. No extra configuration is needed.
:::

### Types

```ts
declare const DouraRoot: (
  props: PropsWithChildren<{
    store?: Doura // optional — auto-creates a store if omitted
  }>
) => JSX.Element
```

### Example

```tsx
import { DouraRoot } from 'react-doura'

// Simplest usage — store is created internally
;<DouraRoot>
  <App />
</DouraRoot>

// Or pass a pre-created store (useful for SSR/testing)
import { doura } from 'doura'
;<DouraRoot store={doura({ initialState: { counter: { count: 10 } } })}>
  <App />
</DouraRoot>
```

## useModel

Reactive hook connected to the global `DouraRoot` store. The component re-renders when accessed state or views change.

`useModel` accepts the model definition directly. It does not accept a separate
name and returns `ModelAPI` directly, not a tuple. `ModelAPI` includes state,
views, actions, direct query fetch functions, and `$queries`; it does not
include child models or `$models`.

### Types

```ts
declare interface UseModel {
  <ModelDef extends ModelDefinition<Model>>(model: ModelDef): ModelAPI<ModelDef>
  <ModelDef extends ModelDefinition<Model>, S extends Selector<ModelDef>>(
    model: ModelDef,
    selector: S,
    depends?: any[]
  ): ReturnType<S>
}
```

### Example

```tsx
import { useModel } from 'react-doura'
import { countModel } from './models/count'

function Counter() {
  // Without selector — ModelAPI
  const counter = useModel(countModel)
  return <button onClick={() => counter.add(1)}>{counter.value}</button>
}

function CounterWithSelector() {
  // With selector — only re-renders when selected values change
  const { value, add } = useModel(
    countModel,
    (api, actions) => ({ value: api.value, add: actions.add }),
    [] // deps — empty means selector function won't change
  )
  return <button onClick={() => add(1)}>{value}</button>
}
```

## useDetachedModel

Creates a component-scoped detached model instance. Each component instance gets its own independent model — it can replace `useState` while enjoying Doura features.

### Types

```ts
declare interface UseDetachedModel {
  <ModelDef extends ModelDefinition<Model>>(model: ModelDef): ModelAPI<ModelDef>
  <ModelDef extends ModelDefinition<Model>, S extends Selector<ModelDef>>(
    model: ModelDef,
    selector: S,
    depends?: any[]
  ): ReturnType<S>
}
```

### Example

```tsx
import { useDetachedModel } from 'react-doura'

const count = defineModel({
  name: 'count',
  state: { value: 1 },
  actions: {
    add(payload: number = 1) {
      this.value += payload
    },
  },
})

const App = () => {
  const counter = useDetachedModel(count)

  return (
    <>
      <div>{counter.value}</div>
      <button onClick={() => counter.add()}>add</button>
    </>
  )
}
```

With a selector:

```tsx
const App = () => {
  const { value, add } = useDetachedModel(
    countModel,
    (api, actions) => ({
      value: api.value,
      add: actions.add,
    }),
    []
  )

  return <button onClick={() => add(2)}>{value}</button>
}
```

## useStaticModel

Returns a non-reactive snapshot of the model. State changes will **not** trigger re-renders. Useful for reading stable references like action methods.

:::caution
In development mode, the returned object is wrapped in a read-only Proxy — directly mutating its properties will log a warning.
:::

### Types

```ts
declare interface UseStaticModel {
  <ModelDef extends ModelDefinition<Model>>(model: ModelDef): ModelAPI<ModelDef>
}
```

### Example

```tsx
import { useStaticModel } from 'react-doura'

const model = defineModel({
  name: 'test',
  state: { value: 1 },
  views: {
    double() {
      return this.value * 2
    },
  },
})

const App = () => {
  const state = useStaticModel(model)

  return (
    <>
      <div>{state.value}</div>
      <div>{state.double}</div>
    </>
  )
}
```

## useQuery

Subscribes to a query's cache entry and triggers fetches based on staleness.
Built on `useSyncExternalStore`.

The first argument can be:

- a direct `QueryFetch`, such as `api.fetchById`
- a `QueryHandle`, such as `api.$queries.fetchById`
- a definition ref, such as `userModel.fetchById`

Definition refs resolve through the nearest Provider store and rebind when the
Provider `store` changes.

### Types

```ts
// No-args query
function useQuery<TData, TSelected = TData>(
  query: QueryFetch<[], TData> | QueryHandle<[], TData>,
  options?: QueryOverrides<TData, TSelected>
): UseQueryResult<TData, TSelected>

// Query with args
function useQuery<TArgs extends readonly unknown[], TData, TSelected = TData>(
  query: QueryFetch<TArgs, TData> | QueryHandle<TArgs, TData>,
  args: TArgs,
  options?: QueryOverrides<TData, TSelected>
): UseQueryResult<TData, TSelected>
```

### `QueryOverrides`

```ts
interface QueryOverrides<TData, TSelected = TData> {
  enabled?: boolean | (() => boolean) // control whether fetch runs
  staleTime?: number // override per-entry/global staleTime
  select?: (data: TData) => TSelected // transform data before returning
  placeholderData?: TData | ((prev?: TData) => TData | undefined)
}
```

### `UseQueryResult`

```ts
interface UseQueryResult<TData, TSelected = TData> {
  data: TSelected | undefined
  error: unknown
  isLoading: boolean // no data, no error, enabled
  isPending: boolean // no data yet
  isFetching: boolean // fetch in progress
  isSuccess: boolean // has data, no error
  isError: boolean // has error
  isStale: boolean // data missing or older than staleTime
  isRefetching: boolean // has data AND currently fetching
  isPlaceholderData: boolean
  refetch: () => Promise<TData>
}
```

### Example

```tsx
import { useQuery } from 'react-doura'
import { userModel } from './models/user'

function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery(userModel.fetchById, [userId], {
    staleTime: 60_000,
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {String(error)}</div>
  return <div>{data.name}</div>
}
```

## useAction

Tracks the lifecycle of calling an action function. Provides
loading/success/error states with race-condition safety.

Pass either a bound action from `useModel()` or a definition ref such as
`formModel.submit`. Definition refs resolve through the nearest Provider store
and rebind when the Provider `store` changes.

### Types

```ts
function useAction<TFn extends (...args: any[]) => any>(
  action: TFn,
  options?: UseActionOptions<Awaited<ReturnType<TFn>>>
): UseActionResult<TFn>
```

### `UseActionOptions`

```ts
interface UseActionOptions<TData> {
  onSuccess?: (data: TData) => void
  onError?: (error: unknown) => void
  onSettled?: (data: TData | undefined, error: unknown | null) => void
  pendingDelay?: number // ms before showing pending state (default: 300)
}
```

### `UseActionResult`

```ts
interface UseActionResult<TFn extends (...args: any[]) => any> {
  run: (...args: Parameters<TFn>) => void // fire-and-forget
  runAsync: (...args: Parameters<TFn>) => Promise<Awaited<ReturnType<TFn>>>
  data: Awaited<ReturnType<TFn>> | undefined
  error: unknown
  isIdle: boolean
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  reset: () => void
}
```

### Semantics

- **Synchronous actions** skip pending entirely — state jumps directly to success/error.
- **Async actions** use a `pendingDelay` (default 300ms) — within this window, the previous settled state stays visible (no loading flash for fast operations).
- **Race-safe** — only the most recent `run`/`runAsync` call can write state. Earlier in-flight runs are abandoned.

### Example

```tsx
import { useAction } from 'react-doura'
import { formModel } from './models/form'

function SubmitButton() {
  const { run, isPending, isError, error } = useAction(formModel.submit, {
    onSuccess: () => alert('Saved!'),
  })

  return (
    <>
      <button onClick={() => run()} disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
      {isError && <span>Error: {String(error)}</span>}
    </>
  )
}
```

## useInfiniteQuery

Paginated query hook that accumulates pages fetched from the same query across
different args. Pass a `QueryFetch`, `QueryHandle`, or definition ref. If a
definition ref resolves to a different handle after a Provider store switch,
the local pages reset and the initial page loads again.

### Types

```ts
function useInfiniteQuery<TArgs extends readonly unknown[], TData>(
  query: QueryFetch<TArgs, TData> | QueryHandle<TArgs, TData>,
  config: InfiniteQueryConfig<TArgs, TData>
): UseInfiniteQueryResult<TArgs, TData>
```

### `InfiniteQueryConfig`

```ts
interface InfiniteQueryConfig<TArgs, TData> {
  initialArgs: TArgs
  getNextArgs: (lastPage: TData, allPages: TData[]) => TArgs | undefined
  getPreviousArgs?: (firstPage: TData, allPages: TData[]) => TArgs | undefined
}
```

### `UseInfiniteQueryResult`

```ts
interface UseInfiniteQueryResult<TArgs, TData> {
  data: { pages: TData[]; args: TArgs[] } | undefined
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
```

### Example

```tsx
import { useInfiniteQuery } from 'react-doura'
import { postsModel } from './models/posts'

function PostList() {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery(postsModel.fetchPage, {
      initialArgs: [1] as [number],
      getNextArgs: (lastPage, allPages) =>
        lastPage.hasMore ? ([allPages.length + 1] as [number]) : undefined,
    })

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {data?.pages.flatMap((page) =>
        page.items.map((post) => <div key={post.id}>{post.title}</div>)
      )}
      {hasNextPage && (
        <button onClick={fetchNextPage} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading more...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
```

## createContainer

Creates an isolated store scope with its own `Provider` and scoped hooks. Useful for independent state contexts within the same app.

### Types

```ts
declare const createContainer: (options?: DouraOptions) => {
  Provider: (
    props: PropsWithChildren<{
      store?: Doura // optional — auto-creates if omitted
    }>
  ) => JSX.Element
  useSharedModel: UseModel
  useStaticModel: UseStaticModel
  useQuery: UseQuery
  useAction: UseAction
  useInfiniteQuery: UseInfiniteQuery
}
```

### Example

```ts
import { createContainer } from 'react-doura'

const {
  Provider, // scoped context provider
  useSharedModel, // reactive hook scoped to this container
  useStaticModel, // non-reactive hook scoped to this container
  useQuery, // query hook scoped to this container
  useAction, // action lifecycle hook scoped to this container
  useInfiniteQuery, // paginated query hook scoped to this container
} = createContainer()
```

## Selector Types

```ts
type Selector<ModelDef extends ModelDefinition<Model>, TReturn = any> = (
  api: ModelAPI<ModelDef>,
  actions: ModelActions<ModelDef>
) => TReturn
```

### Example

```ts
import { Selector } from 'react-doura'
import { ModelAPI, ModelActions } from 'doura'

const countSelector: Selector<typeof countModel> = (s, actions) => {
  return { count: s.count, add: actions.add }
}
```
