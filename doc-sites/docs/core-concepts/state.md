---
id: state
title: State
---

The state is, most of the time, the central part of your model. People often start by defining the state that represents their app.

```js
import { defineModel } from 'doura'

export const countModel = defineModel({
  name: 'counter',
  // all these properties will have their type inferred automatically
  state: {
    count: 0,
    name: 'test',
    max: 100,
  },
})
```

## Accessing the `state`

By default, you can directly read and write to the state by accessing it through the `model` instance:

```js
const counter = store.getModel(countModel)

counter.count++
```

Note you cannot add a new state property **if you don't define it in `state`**, it must contain the initial state. e.g.: we can't do `counter.secondCount = 2` if `secondCount` is not defined in `state`.

## Replacing the `state`

You can replace the state of a model by assigning the new state to `$state`:

```js
const model = store.getModel(countModel)

model.$state = { count: 24 }
```

## Subscribing to the state

You can subscribe to state changes at both the model level and the store level.

### Model-level subscription

Use `$subscribe` on a model instance to be notified whenever that model's state changes:

```js
const counter = store.getModel(countModel)

const unsubscribe = counter.$subscribe(() => {
  console.log('counter state changed:', counter.$state)
})

counter.count++ // logs: "counter state changed: { count: 1, name: 'test', max: 100 }"

// stop listening
unsubscribe()
```

### Store-level subscription

Use `store.subscribe()` to be notified whenever any model in the store changes:

```js
const store = doura()

const unsubscribe = store.subscribe(() => {
  console.log('some model changed, full state:', store.getState())
})

// stop listening
unsubscribe()
```
