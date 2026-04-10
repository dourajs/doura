---
id: store
title: Store
---

A model is only a definination of your data & loic. It's need to be init and accessed by a store.

```js
export const counterModel = defineModel({
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

const modelInstance = store.getModel('counter', counterModel)

// call the action as a method of the model instance
modelInstance.increment()

// read the state as a props of the model instance
console.log(modelInstance.count) // 1

// we can init a new instance with the same model by passing a different name
const anotherModelInstance = store.getModel('counterAlt', counterModel)

console.log(anotherModelInstance) // 0
```

## Setting initial state

Initial state can be setted by passing `initialState` options to `doura()`

```js
const store = doure({
  initialState: {
    counter: {
      count: 100,
    },
  },
})

const modelInstance = store.getModel('counter', counterModel)

console.log(modelInstance.count) // 100
```

## Multil Store

A model can be used in multi store, they will have independent state.

```js
const storeA = doure()
const storeB = doure()

const counterA = storeA.getModel('counter', counterModel)
const counterB = storeB.getModel('counter', counterModel)

console.log(counterA.count) // 0
console.log(counterB.count) // 0

counterA.increment()

console.log(counterA.count) // 1
console.log(counterB.count) // 0
```
