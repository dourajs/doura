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
      this.double
    },
  },
})
```

## `defineModel`

There is two ways define a model, object or function.

### Types

```ts
export type DefineModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  P extends Params
> = ModelOptions<S, A, V, P> & {}
```

### `defineModel` By Object

The basic way to define model.

```tsx
const countModel = defineModel({
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

### `defineModel` By Function

Composing other models by using function.

```ts
import { use } from 'doura';

const countModel = defineModel({
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

const model = defineModel(() => {
  const count = use('count', countModel)
  return {
    state: { value: 0 },
    actions: {
      add(p: number) {
        this.value += p
      },
    },
    views: {
      all() {
        return {
          value: this.value,
          depDouble: count.double,
        }
      },
    },
  }
})
```

## `doura`

Creates a store (`Doura` instance) that manages model instances.

### Types

```ts
function doura(options?: DouraOptions): Doura

interface DouraOptions {
  initialState?: Record<string, any>
  plugins?: [Plugin, any?][]
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

const modelInstance = store.getModel('counter', counterModel)

console.log(modelInstance.count) // 100
```

## `ModelInstance`

Get model state, call actions and views.

### Example

```ts
const store = doura()
const model = defineModel({
  state: { value: 0 },
  actions: {
    actionOne() {
      // ...change state
    },
  },
  views: {
    viewOne() {},
  },
})

const modelInstance = store.getModel('test', model)
modelInstance.$state // { value: 0 }
modelInstance.actionOne() // undefined
modelInstance.viewOne // undefined
```

## `Doura`

The store object returned by `doura()`. Manages named and detached model instances.

### Types

```ts
interface Doura {
  getState(): Record<string, State>
  getModel<IModel extends AnyModel>(name: string, model: IModel): ModelPublicInstance<IModel>
  getDetachedModel<IModel extends AnyModel>(model: IModel): ModelPublicInstance<IModel>
  subscribe(fn: () => any): () => void
  destroy(): void
}
```

### Methods

- **`getState()`** — Returns a snapshot of all named models' state, keyed by model name.
- **`getModel(name, model)`** — Retrieves or creates a named model instance. Repeated calls with the same name return the same instance.
- **`getDetachedModel(model)`** — Creates an anonymous model instance that is not registered in the store and not included in `getState()`.
- **`subscribe(fn)`** — Registers a listener that fires whenever any named model's state changes (batched via microtask). Returns an unsubscribe function.
- **`destroy()`** — Destroys the store: calls `onDestroy` on all plugin hooks, destroys all model instances, and clears subscribers.

### Example

```ts
const store = doura()
const counter = store.getModel('counter', counterModel)

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

Executes the given function in a scope where reactive values can be read, but they cannot cause the caller's reactive scope to re-evaluated when they change. Useful for optimizing views that read nested objects.

### Types

```ts
$isolate: <T>(fn: (state: ModelState<IModel>) => T) => T
```

### Example

```ts
const userModel = defineModel({
  state: {
    user: { name: 'alice', age: 18 },
  },
  views: {
    userName() {
      // without $isolate, changes to user.age would also invalidate this view
      const user = this.$isolate((state) => state.user)
      return user.name  // only re-evaluates when user.name changes
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
  state: {
    lib: markRaw(new SomeExternalLib()),  // will not be made reactive
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
  state: {
    data: obj,  // non-enumerable 'hidden' property will be preserved during copy-on-write
  },
})
```
