---
id: doura
title: Doura
---

## State

### Types

```ts
type StateObject = {
  [x: string]: any
}
```

## Action

### Types

```ts
type ActionOptions = Record<string, Function>
```

### Action Semantics

Actions can change state in three public forms:

- **Modify** — Directly update state properties via `this`. This is the most common pattern.
  ```ts
  increment() {
    this.count += 1  // triggers a MODIFY action
  }
  ```
- **Replace** — Assign a new value to `this.$state` to completely replace the model's state.

  ```ts
  reset() {
    this.$state = { count: 0 }  // triggers a REPLACE action
  }
  ```

- **Patch** — Call `this.$patch(obj)` to deep-merge a partial object into the current state.
  ```ts
  patchSome() {
    this.$patch({ count: 2 })  // triggers a PATCH action
  }
  ```

### Example

```tsx
const count = defineModel({
  name: 'count',
  state: { value: 0 },
  actions: {
    add(p: number) {
      this.value += p
    },
    nested() {
      this.add(1)
    },
    async asyncAction(): Promise<void> {
      this.value += 1
      await timeout(1000)
      this.value += 1
    },
    replaceState(n: number) {
      this.$state = { value: n }
    },
    patchState() {
      this.$patch({ value: 2 })
    },
  },
})
```

## View

### Types

```ts
type ViewOptions<State = any> = Record<
  string,
  ((s: State) => any) | (() => any)
>
```

### Example

```tsx
const count = defineModel({
  name: 'count',
  state: {
    count: 1,
  },
  views: {
    double(s) {
      return s.count * 2
    },
    doubleByThis() {
      return this.count * 2
    },
    nested() {
      return this.double
    },
  },
})
```

## `defineModel`

Defines a model — the unit of state, logic, and derived data in Doura.

### Types

```ts
function defineModel<N, S, A, V, Models, Q>(
  options: {
    name: N // required: unique string identifier
    state: S // required: initial state object
    actions?: A // optional: methods that update state
    views?: V // optional: computed/derived values
    models?: Models // optional: array of child models for composition
    queries?: Q // optional: async data fetching functions
  },
  setup?: (ctx: {
    model: {
      setQueryOptions<K extends keyof Q>(name: K, options: QueryOptions): void
    }
  }) => void
): ModelDefinition<Model<S, A, V, Models, Q> & { name: N }>
```

Keys across `state`, `actions`, `views`, `queries`, and child model names must
not conflict. TypeScript reports conflicts for literal keys, and `defineModel()`
throws at runtime for dynamic conflicts, duplicated child model names, and
`$options` action/query definition-ref names.

### Example

```tsx
const countModel = defineModel({
  name: 'count',
  state: { count: 1 },
  actions: {
    add(p: number) {
      this.count += p
    },
  },
  views: {
    double() {
      return this.count * 2
    },
  },
})
```

## `ModelDefinition`

`defineModel()` returns a `ModelDefinition`. A definition is the only model
value accepted by `store.getModel()`, `store.getDetachedModel()`, and React
model hooks.

### Types

```ts
type ModelDefinition<M extends Model = Model> = {
  readonly $options: M
} & ActionDefinitionRefs<M> &
  QueryDefinitionRefs<M>
```

- `$options` contains the raw model options object.
- `$options` is a reserved field and cannot be used as an action or query name.
- `definition.actionName` and `definition.queryName` are lightweight refs used
  by React hooks. They are not bound to a store until a hook resolves them from
  the current Provider context.

### Model Composition

Use the `models` option to compose child models. Child models are accessed via
`this.childName` inside actions and views. The key comes from the child
definition's `$options.name`.

```ts
const countModel = defineModel({
  name: 'count',
  state: { count: 1 },
  actions: {
    add(p: number) {
      this.count += p
    },
  },
  views: {
    double() {
      return this.count * 2
    },
  },
})

const parentModel = defineModel({
  name: 'parent',
  state: { value: 0 },
  models: [countModel],
  actions: {
    add(p: number) {
      this.value += p
    },
  },
  views: {
    all() {
      return {
        value: this.value,
        depDouble: this.count.double,
      }
    },
  },
})
```

## Query Options

Query entries are always functions. Configure per-query options in the optional second argument to `defineModel()` with `model.setQueryOptions(name, options)`.

### Types

```ts
model.setQueryOptions<K extends keyof queries>(
  name: K,
  options: QueryOptions
): void

interface QueryOptions<TApi, TArgs, TData> {
  staleTime?: number
  onData?: (ctx: OnDataCtx<TApi, TArgs, TData>) => void
}

interface OnDataCtx<TApi, TArgs, TData> {
  api: TApi   // the model's internal proxy (same as `this` in actions)
  args: TArgs // the args tuple passed to the query
  data: TData // the fetched data
}
```

### `staleTime`

Controls how long fetched data is considered fresh (in milliseconds). Defaults to `0` (always stale).

### `onData`

A callback invoked whenever new data arrives for this query (both from `fetch()` and `setData()`). Runs inside an action context — you can update state, call actions, and access child models via `ctx.api`. The query cache is updated automatically after `onData` completes.

Use `onData` to sync fetched data into model state without manual action calls:

```ts
import { defineModel } from 'doura'

const userModel = defineModel(
  {
    name: 'user',
    state: { users: {} as Record<string, User> },
    queries: {
      fetchAll: async function (ctx) {
        const res = await fetch('/api/users', { signal: ctx.signal })
        return res.json()
      },

      fetchById: async function (ctx, id: string) {
        const res = await fetch(`/api/users/${id}`, { signal: ctx.signal })
        return res.json()
      },
    },
  },
  ({ model }) => {
    model.setQueryOptions('fetchById', {
      staleTime: 30_000,
      onData({ api, data }) {
        // Automatically write fetched user into model state
        api.users[data.id] = data
      },
    })
  }
)
```

:::caution
Query functions do NOT have `this` bound to the model — `this` is `undefined` inside query functions. Use `onData` to update model state when data arrives.
:::

The advantage of `onData` is that it runs both when `fetch()` completes AND when `setData()` is called manually, ensuring state stays in sync regardless of how data enters the cache.

## `QueryFetch`

Direct query access on `ModelInstance`, `ModelAPI`, and action `this` is a
fetch function.

### Types

```ts
type QueryFetch<TArgs extends readonly unknown[] = any[], TData = any> = (
  ...args: TArgs
) => Promise<TData>
```

### Example

```ts
const users = store.getModel(userModel)

const user = await users.fetchById('user-1')

const api = users.$getApi()
await api.fetchById('user-2')
```

Use `$queries.queryName` when you need cache state or control methods.

## `QueryHandle`

The runtime query object for cache reads and control methods. Access it through
`instance.$queries.queryName`, `api.$queries.queryName`, or action
`this.$queries.queryName`.

### Methods

| Method                   | Description                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ |
| `getData(...args)`       | Read cached data without triggering a fetch. Returns `undefined` if absent.    |
| `getState(...args)`      | Read the raw cache entry (`{ data, error, dataUpdatedAt, fetchStatus }`).      |
| `isFetching(...args)`    | `true` if the query is currently fetching.                                     |
| `isStale(...args)`       | `true` if the cached data is missing or older than `staleTime`.                |
| `fetch(...args)`         | Kick off a fetch. Returns a Promise resolving with the data.                   |
| `prefetch(...args)`      | Fetch and warm the cache. Returns `Promise<void>`.                             |
| `cancel(...args?)`       | Cancel inflight request for specific args, or all inflight requests (no args). |
| `invalidate(...args?)`   | Mark cached entry stale without clearing data. No args = invalidate all.       |
| `reset(...args?)`        | Clear the cached entry entirely. No args = reset all.                          |
| `setData(...args, data)` | Write data directly into the cache.                                            |

### `QueryCtx`

```ts
interface QueryCtx {
  signal: AbortSignal // fires when cancel() is called
}
```

### `QueryCacheEntry`

```ts
interface QueryCacheEntry {
  data: unknown
  error: unknown
  dataUpdatedAt: number
  fetchStatus: 'idle' | 'fetching'
}
```

## `doura`

Creates a store (`Doura` instance) that manages model instances.

### Types

```ts
function doura(options?: DouraOptions): Doura

interface DouraOptions {
  initialState?: Record<string, any>
  plugins?: [Plugin, any?][]
  query?: {
    gcTime?: number // garbage collection time (default: 5 min)
    staleTime?: number // how long data is fresh (default: 0)
  }
}
```

### Example

```ts
const store = doura({
  initialState: {
    counter: {
      count: 100,
    },
  },
})

const modelInstance = store.getModel(counterModel)

console.log(modelInstance.count) // 100
```

## `ModelAPI`

The snapshot returned by `instance.$getApi()` and by React hooks such as
`useModel()` without a selector. It contains state, views, actions, direct query
fetch functions, and `$queries`.

`ModelAPI` intentionally does not include child models or `$models`. Use the
`ModelInstance` returned by `store.getModel()` when direct child model access is
needed.

## `ModelInstance`

The runtime model instance returned by `store.getModel(model)`. Provides direct
access to state, actions, views, direct query fetch functions, and child models.

### Flat Access

All state keys, action methods, view properties, direct query fetch functions,
and child model instances are accessible directly:

```ts
const store = doura()
const model = defineModel({
  name: 'test',
  state: { value: 0 },
  actions: {
    actionOne() {
      this.value = 1
    },
  },
  views: {
    double() {
      return this.value * 2
    },
  },
})

const instance = store.getModel(model)
instance.value // 0 (state)
instance.actionOne() // call action
instance.double // 0 (view)
```

For queries:

```ts
await instance.fetchUser('user-1') // QueryFetch
instance.$queries.fetchUser.invalidate('user-1') // QueryHandle
```

### `$`-prefixed API

| Property / Method       | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `$name`                 | The model's name                                                            |
| `$state`                | Current state (assignable to replace)                                       |
| `$rawState`             | Raw state snapshot                                                          |
| `$actions`              | Actions map                                                                 |
| `$views`                | Views map                                                                   |
| `$queries`              | Query handles map                                                           |
| `$models`               | Child model instances map                                                   |
| `$patch(obj)`           | Deep merge partial state                                                    |
| `$onAction(listener)`   | Subscribe to action calls. Returns unsubscribe.                             |
| `$subscribe(listener)`  | Subscribe to state changes. Returns unsubscribe.                            |
| `$isolate(fn)`          | Read state without tracking (for view optimization)                         |
| `$getApi()`             | Get a `ModelAPI` snapshot (state + views + actions + query fetches + `$queries`) |
| `$createView(selector)` | Create a reactive derived view. Returns `{ (): T, destroy(): void }`.       |
| `$invalidateQueries()`  | Mark all query cache entries stale                                          |
| `$cancelQueries()`      | Cancel all inflight query requests                                          |
| `$resetQueries()`       | Clear all query cache entries                                               |

## `Doura`

The store object returned by `doura()`. Manages named and detached model instances.

### Types

```ts
interface Doura {
  getState(): Record<string, State>
  getModel<ModelDef extends ModelDefinition<Model>>(
    model: ModelDef
  ): ModelInstance<ModelDef>
  getDetachedModel<ModelDef extends ModelDefinition<Model>>(
    model: ModelDef
  ): ModelInstance<ModelDef>
  subscribe(fn: () => any): () => void
  destroy(): void
}
```

### Methods

- **`getState()`** — Returns a snapshot of all named models' state, keyed by model name.
- **`getModel(model)`** — Retrieves or creates a named model instance. The input must be a `ModelDefinition`; the cache key is `model.$options.name`.
- **`getDetachedModel(model)`** — Creates a detached model instance that is not registered in the store and not included in `getState()`.
- **`subscribe(fn)`** — Registers a listener that fires whenever any named model's state changes (batched via microtask). Returns an unsubscribe function.
- **`destroy()`** — Destroys the store: calls `onDestroy` on all plugin hooks, destroys all model instances, and clears subscribers.

### Example

```ts
const store = doura()
const counter = store.getModel(counterModel)

// subscribe to any model change
const unsubscribe = store.subscribe(() => {
  console.log('state changed:', store.getState())
})

counter.increment()

// cleanup
unsubscribe()
store.destroy()
```

## `Plugin`

Plugins are functions that return lifecycle hooks. They are registered with
`doura({ plugins: [[plugin, option]] })`.

### Types

```ts
interface PluginContext {
  doura: ModelManager
}

type PluginHook = {
  onInit?(
    options: { initialState: Record<string, State> },
    context: PluginContext
  ): void
  onModel?(name: string, model: Model, context: PluginContext): void
  onModelInstance?(
    instance: ModelInstance<ModelDefinition<Model>>,
    context: PluginContext
  ): void
  onDestroy?(): void
}

type Plugin<Option = any> = (option: Option) => PluginHook
```

`onModel` receives the model name and raw model options. `onModelInstance`
receives the public `ModelInstance`.

## `$isolate`

Executes the given function in a scope where reactive values can be read, but they cannot cause the caller's reactive scope to re-evaluate when they change. Useful for optimizing views that read nested objects.

### Types

```ts
$isolate: <T>(fn: (state: ModelState<ModelDef>) => T) => T
```

### Example

```ts
const userModel = defineModel({
  name: 'user',
  state: {
    user: { name: 'alice', age: 18 },
  },
  views: {
    userName() {
      // without $isolate, changes to user.age would also invalidate this view
      const user = this.$isolate((state) => state.user)
      return user.name // only re-evaluates when user.name changes
    },
  },
})
```

See also: [Optimizing Views](../../guides/optimize-views.md)

## `markRaw`

Marks an object so that it will never be wrapped in a reactive draft proxy. The object is returned as-is from the reactivity system. Useful for third-party class instances, immutable data structures, or objects that should not be tracked.

### Types

```ts
function markRaw<T extends object>(value: T): T
```

### Example

```ts
import { markRaw, defineModel } from 'doura'

class SomeExternalLib {
  // ...
}

const model = defineModel({
  name: 'app',
  state: {
    lib: markRaw(new SomeExternalLib()), // will not be made reactive
    count: 0,
  },
})
```

## `markStrict`

Marks a plain object so that when the reactivity system shallow-copies it, all property descriptors (including non-enumerable and symbol properties) are preserved. By default, plain objects are copied using only `Object.keys` (fast path).

### Types

```ts
function markStrict<T extends object>(value: T): T
```

### Example

```ts
import { markStrict, defineModel } from 'doura'

const obj = markStrict(
  Object.defineProperty({}, 'hidden', {
    value: 42,
    enumerable: false,
  })
)

const model = defineModel({
  name: 'app',
  state: {
    data: obj, // non-enumerable 'hidden' property will be preserved during copy-on-write
  },
})
```

## `nextTick`

Returns a Promise that resolves after the current flush cycle completes. Use this when you need to wait for all pending state updates (queued via the microtask scheduler) to be flushed before reading state.

### Types

```ts
function nextTick<T = void>(fn?: () => void): Promise<void>
```

### Example

```ts
import { nextTick } from 'doura'

// Wait for all queued updates to flush
await nextTick()
console.log(store.getState()) // guaranteed to reflect all pending changes
```

## `computeQueryHash` / `computeArgsKey`

Low-level utilities for computing the cache hash of a query entry. Useful for advanced scenarios such as cache pre-warming or debugging.

### Types

```ts
function computeQueryHash(
  modelName: string,
  queryName: string,
  key: unknown[]
): QueryHash
function computeArgsKey(args: readonly unknown[] | void): unknown[]
```

- `modelName` — for named models this is `model.$options.name`; for detached models it's an internal `@@detached:<id>` string.
- `queryName` — the key in `queries`.
- `key` — the args tuple (produced by `computeArgsKey`). The hash function internally serializes it to a stable string.

### Example

```ts
import { computeQueryHash, computeArgsKey } from 'doura'

const hash = computeQueryHash('user', 'fetchById', computeArgsKey(['user-1']))
```
