---
id: views
title: Views
---

Views are used for computing derived state of a model. They can be defined with the `views` property in `defineModel()`.

```js
export const counterModel = defineModel('counter', {
  name: 'counter',
  state: {
    count: 0,
  },
  views: {
    doubleCount() {
      return this.count * 2,
    }
  },
})
```

Most of the time, views will only rely on the state, however, they might need to use other views. Because of this, we can get access to the _whole model instance_ through `this` when defining a regular function:

```ts
export const counterModel = defineModel('counter', {
  state: {
    count: 0,
  },
  getters: {
    // automatically infers the return type as a number
    doubleCount() {
      return this.count * 2
    },
    // automatically infers the return type as a number
    doublePlusOne() {
      return this.doubleCount + 1
    },
  },
})
```

Then you can access the view directly on the model instance:

```js
const counter = store.getModel(counterModel)

console.log(counter.doubleCount)
```
