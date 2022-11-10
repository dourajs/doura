---
id: state
title: State
---

The state is, most of the time, the central part of your model. People often start by defining the state that represents their app.

```js
import { defineModel } from 'doura'

export const model = defineModel({
  name: 'model',
  // arrow function recommended for full type inference
  state: {
    // all these properties will have their type inferred automatically
    count: 0,
    name: 'Eduardo',
    isAdmin: true,
  },
})
```

## Accessing the `state`

By default, you can directly read and write to the state by accessing it through the `model` instance:

```js
const store = store.getModel(countModel)

store.count++
```

Note you cannot add a new state property **if you don't define it in `state`**, it must contain the initial state. e.g.: we can't do `model.secondCount = 2` if `secondCount` is not defined in `state`.

## Resetting the state

You can _reset_ the state to its initial value by calling the `$reset()` method on the model:

```js
const model = store.getModel(countModel)

model.$reset()
```

## Replacing the `state`

You **cann replace** the state of a model by assgining the new state to `$state`:

```js
const model = store.getModel(countModel)

model.$state = { count: 24 }
```

## Subscribing to the state

Documentation coming soon...
