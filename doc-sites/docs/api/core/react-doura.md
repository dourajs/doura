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
name and returns the model API directly, not a tuple.

### Types

```ts
declare interface UseModel {
  <IModel extends AnyModel>(model: IModel): ModelAPI<IModel>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
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
  // Without selector — full API
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
  <IModel extends AnyModel>(model: IModel): ModelAPI<IModel>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
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
  <IModel extends AnyModel>(model: IModel): ModelAPI<IModel>
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

Subscribes to a query's cache entry and triggers fetches based on staleness. Built on `useSyncExternalStore`.

### Types

```ts
// No-args query
function useQuery<TData, TSelected = TData>(
  queryHandle: QueryHandle<[], TData>,
  options?: QueryOverrides<TData, TSelected>
): UseQueryResult<TData, TSelected>

// Query with args
function useQuery<TArgs extends readonly unknown[], TData, TSelected = TData>(
  queryHandle: QueryHandle<TArgs, TData>,
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
import { useModel, useQuery } from 'react-doura'
import { userModel } from './models/user'

function UserProfile({ userId }: { userId: string }) {
  const user = useModel(userModel)

  const { data, isLoading, error } = useQuery(user.fetchById, [userId], {
    staleTime: 60_000,
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {String(error)}</div>
  return <div>{data.name}</div>
}
```

## useAction

Tracks the lifecycle of calling an action function. Provides loading/success/error states with race-condition safety.

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
import { useModel, useAction } from 'react-doura'
import { formModel } from './models/form'

function SubmitButton() {
  const form = useModel(formModel)
  const { run, isPending, isError, error } = useAction(form.submit, {
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

Paginated query hook that accumulates pages fetched from the same `QueryHandle` across different args.

### Types

```ts
function useInfiniteQuery<TArgs extends readonly unknown[], TData>(
  queryHandle: QueryHandle<TArgs, TData>,
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
import { useModel, useInfiniteQuery } from 'react-doura'
import { postsModel } from './models/posts'

function PostList() {
  const posts = useModel(postsModel)

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery(posts.fetchPage, {
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

Creates an isolated store scope with its own `Provider`, `useSharedModel`, and `useStaticModel`. Useful for independent state contexts within the same app.

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
}
```

### Example

```ts
import { createContainer } from 'react-doura'

const {
  Provider, // scoped context provider
  useSharedModel, // reactive hook scoped to this container
  useStaticModel, // non-reactive hook scoped to this container
} = createContainer()
```

## Selector Types

```ts
type Selector<Model extends AnyModel, TReturn = any> = (
  api: ModelAPI<Model>,
  actions: ModelActions<Model>
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
