---
id: store
title: Store
---

A model is a definition of your data and logic. It needs to be initialized and accessed by a store.

```js
import { defineModel, doura } from 'doura'

export const counterModel = defineModel({
  name: 'counter',
  state: {
    count: 0,
  },
  actions: {
    // since we rely on `this`, we cannot use an arrow function
    increment() {
      this.count++
    },
    randomizeCounter() {
      this.count = Math.round(100 * Math.random())
    },
  },
})

const store = doura()

const modelInstance = store.getModel(counterModel)

// call the action as a method of the model instance
modelInstance.increment()

// read the state as a property of the model instance
console.log(modelInstance.count) // 1
```

## Setting initial state

Initial state can be set by passing `initialState` options to `doura()`. The key in `initialState` corresponds to the model's `name`.

```js
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

## Multiple Stores

A model can be used in multiple stores, they will have independent state.

```js
const storeA = doura()
const storeB = doura()

const counterA = storeA.getModel(counterModel)
const counterB = storeB.getModel(counterModel)

console.log(counterA.count) // 0
console.log(counterB.count) // 0

counterA.increment()

console.log(counterA.count) // 1
console.log(counterB.count) // 0
```
