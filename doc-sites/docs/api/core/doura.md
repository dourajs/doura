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

Actions can modify state in three ways, each producing a different action type:

- **Modify** — Directly mutate state properties via `this`. This is the most common pattern.
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
- **Patch** — Return a plain object from the action to deep-merge it into the current state.
  ```ts
  patch() {
    return { count: 2 }  // triggers a PATCH action (deep merge)
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
    changeStateBy$state(n: number) {
      this.$state.value += n
    },
    changeStateByReturnValue() {
      return { value: 2 }
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
    actions?: A // optional: methods that mutate state
    views?: V // optional: computed/derived values
    models?: Models // optional: array of child models for composition
    queries?: Q // optional: async data fetching functions
  },
  setup?: (ctx: {
    model: {
      setQueryOptions<K extends keyof Q>(
        name: K,
        options: { staleTime?: number }
      ): void
    }
  }) => void
): DefineModel<S, A, V, Models>
```

Keys across `state`, `actions`, `views`, `queries`, and `models` must not conflict — TypeScript will report a compile-time error if they do.

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

### Model Composition

Use the `models` option to compose child models. Child models are accessed via `this.childName` (the child model's `name` field) inside actions and views.

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
  options: { staleTime?: number }
): void
```

### Example

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
        const user = await res.json()
        this.users[id] = user
        return user
      },
    },
  },
  ({ model }) => {
    model.setQueryOptions('fetchById', { staleTime: 30_000 })
  }
)
```

## `QueryHandle`

The runtime query object available on model instances for each query entry. Accessed as `instance.queryName` or `instance.$queries.queryName`.

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

## `ModelInstance`

The runtime model instance returned by `store.getModel(model)`. Provides direct access to state, actions, views, queries, and child models.

### Flat Access

All state keys, action methods, view properties, query handles, and child model instances are accessible directly:

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
| `$getApi()`             | Get a snapshot of the full API (state + views + actions + queries + models) |
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
  getModel<IModel extends AnyModel>(model: IModel): ModelInstance<IModel>
  getDetachedModel<IModel extends AnyModel>(
    model: IModel
  ): ModelInstance<IModel>
  subscribe(fn: () => any): () => void
  destroy(): void
}
```

### Methods

- **`getState()`** — Returns a snapshot of all named models' state, keyed by model name.
- **`getModel(model)`** — Retrieves or creates a named model instance. Repeated calls with the same model return the same instance.
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

## `$isolate`

Executes the given function in a scope where reactive values can be read, but they cannot cause the caller's reactive scope to re-evaluate when they change. Useful for optimizing views that read nested objects.

### Types

```ts
$isolate: <T>(fn: (state: ModelState<IModel>) => T) => T
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
