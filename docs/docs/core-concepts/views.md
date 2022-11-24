---
id: views
title: Views
---

Views are used for computing derived state of a model. They can be defined with the `views` property in `defineModel()`.

```js
export const counterModel = defineModel({
  state: {
    count: 0,
  },
  views: {
    doubleCount: (state) => state.count * 2,
  },
})
```

Most of the time, views will only rely on the state, however, they might need to use other views. Because of this, we can get access to the _whole model instance_ through `this` when defining a regular function:

```ts
export const counterModel = defineModel({
  state: {
    count: 0,
  },
  views: {
    // automatically infers the return type as a number
     doubleCount: (state) => state.count * 2,
    // automatically infers the return type as a number
    doublePlusOne() {
      // use this to access other views 
      return this.doubleCount + 1
    },
  },
})
```

Then you can access the view directly on the model instance:

```js
const counter = store.getModel('counter', counterModel)

console.log(counter.doubleCount)
```
