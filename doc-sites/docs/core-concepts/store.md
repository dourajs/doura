---
id: store
title: Store
---

A store is created with `doura()`. It owns named model instances, plugins, and
query defaults.

```ts
import { defineModel, doura } from 'doura'

const counterModel = defineModel({
  name: 'counter',
  state: { count: 0 },
  actions: {
    increment() {
      this.count += 1
    },
  },
})

const store = doura()
const counter = store.getModel(counterModel)

counter.increment()
console.log(counter.count) // 1
```

## Options

```ts
const store = doura({
  initialState: {
    counter: { count: 100 },
  },
  plugins: [[myPlugin, options]],
  query: {
    staleTime: 10_000,
    gcTime: 300_000,
  },
})
```

- `initialState` is keyed by model name and applies when a named model is first
  created.
- `plugins` is an array of `[plugin, options?]` tuples.
- `query` sets store-wide defaults for query cache staleness and garbage
  collection.

## API

| Method                    | Description                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `getModel(model)`         | Get or create a named model instance. The instance is cached by `model.name`.                |
| `getDetachedModel(model)` | Create an independent model instance that is not cached and is not included in `getState()`. |
| `getState()`              | Return a snapshot of all named models' state, keyed by model name.                           |
| `subscribe(fn)`           | Listen to any named model state change. Returns an unsubscribe function.                     |
| `destroy()`               | Destroy model instances, plugin hooks, subscribers, and query coordination.                  |

## Multiple Stores

The same model definition can be used in multiple stores. Each store has
independent state.

```ts
const storeA = doura()
const storeB = doura()

const counterA = storeA.getModel(counterModel)
const counterB = storeB.getModel(counterModel)

counterA.increment()

console.log(counterA.count) // 1
console.log(counterB.count) // 0
```
