---
id: actions
title: Actions
---

Actions can be defined with the `actions` property in `defineModel()` and **they are perfect to define business logic**:

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
```

Actions get access to the _whole model instance_ through `this` with **full typing (and autocompletion ✨) support**. **`actions` can be asynchronous**, you can `await` inside of actions any API call or even other actions!

```js
export const useUsers = defineModel({
  state: {
    userData: null,
  },
  actions: {
    async registerUser(login, password) {
      try {
        this.userData = await api.post({ login, password })
        showTooltip(`Welcome back ${this.userData.name}!`)
      } catch (error) {
        showTooltip(error)
        // let the form component display the error
        return error
      }
    },
  },
})
```

You are also completely free to set whatever arguments you want and return anything. When calling actions, everything will be automatically inferred!

Actions are invoked like methods:

```js
const counter = store.getModel('counter', counterModel)
// call the action as a method of the model
counter.randomizeCounter()
```
