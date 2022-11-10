---
id: store
title: Store
---

A model is only a definination of your data & loic. It's need to be init and accessed by a store. We call store a model manager internally.

```js
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

const store = doure()

const modelInstance = store.getModel(counterModel)

// call the action as a method of the model instance
modelInstance.increment()

// read the state as a props of the model instance
console.log(modelInstance.count)
```

## Setting initial state

Initial state can be setted by passing `initialState` options to `doura()`

```js
const store = doure({
  initialState: {
    // using the name of a model as key
    counter: {
      count: 100,
    },
  },
})

const modelInstance = store.getModel(counterModel)

console.log(modelInstance.count) // 100
```

## Multil Store

A model can be used in multi store, they will have independent state.

```js
const storeA = doure()
const storeB = doure()

const counterA = storeA.getModel(counterModel)
const counterB = storeB.getModel(counterModel)

console.log(counterA.count) // 0 
console.log(counterB.count) // 0

counterA.increment()

console.log(counterA.count) // 1 
console.log(counterB.count) // 0
```
