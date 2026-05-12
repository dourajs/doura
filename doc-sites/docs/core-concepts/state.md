---
id: state
title: State
---

State is the initial data shape of a model. It must be present in
`defineModel()` and should include every state property you plan to use.

```ts
import { defineModel } from 'doura'

export const countModel = defineModel({
  name: 'counter',
  state: {
    count: 0,
    name: 'test',
    max: 100,
  },
})
```

## Accessing State

Model instances expose state keys directly:

```ts
const counter = store.getModel(countModel)

console.log(counter.count)
```

Actions can update state through `this`:

```ts
actions: {
  increment() {
    this.count += 1
  },
}
```

External consumers should update state by calling actions. Direct writes to a
public instance are intended for low-level use; model state changes are normally
centralized in actions.

## Replacing State

Assign to `$state` to replace the whole state object:

```ts
const counter = store.getModel(countModel)

counter.$state = { count: 24, name: 'test', max: 100 }
```

Use `$patch()` to deep-merge a partial object:

```ts
counter.$patch({ count: 25 })
```

## Subscribing

Use `$subscribe` for one model instance:

```ts
const unsubscribe = counter.$subscribe(() => {
  console.log(counter.$rawState)
})

unsubscribe()
```

Use `store.subscribe()` to listen to changes from any named model in the store:

```ts
const unsubscribe = store.subscribe(() => {
  console.log(store.getState())
})

unsubscribe()
```
