---
id: state
title: State
---

The state is, most of the time, the central part of your model. People often start by defining the state that represents their app.

```js
import { defineModel } from 'doura'

export const countModel = defineModel({
  // arrow function recommended for full type inference
  state: {
    // all these properties will have their type inferred automatically
    count: 0,
    name: 'test',
    max: 100,
  },
})
```

## Accessing the `state`

By default, you can directly read and write to the state by accessing it through the `model` instance:

```js
const counter = store.getModel('counter', countModel)

counter.count++
```

Note you cannot add a new state property **if you don't define it in `state`**, it must contain the initial state. e.g.: we can't do `counter.secondCount = 2` if `secondCount` is not defined in `state`.

## Replacing the `state`

You **cann replace** the state of a model by assgining the new state to `$state`:

```js
const model = store.getModel('counter', countModel)

model.$state = { count: 24 }
```

## Subscribing to the state

Documentation coming soon...
