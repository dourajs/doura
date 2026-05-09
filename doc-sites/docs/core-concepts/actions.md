---
id: actions
title: Actions
---

Actions are methods declared under `actions` in `defineModel()`. They are bound
to the model's internal proxy, so `this` can read state, views, actions, query
handles, and child models.

```ts
import { defineModel } from 'doura'

export const counterModel = defineModel({
  name: 'counter',
  state: {
    count: 0,
  },
  actions: {
    increment(step = 1) {
      this.count += step
    },
    reset() {
      this.$state = { count: 0 }
    },
    patchCount(count: number) {
      this.$patch({ count })
    },
  },
})
```

Do not use arrow functions for actions that need `this`.

## Async Actions

Actions can be asynchronous and can call other actions:

```ts
export const userModel = defineModel({
  name: 'user',
  state: {
    userData: null as User | null,
    loading: false,
  },
  actions: {
    async registerUser(login: string, password: string) {
      this.loading = true
      try {
        this.userData = await api.post({ login, password })
      } finally {
        this.loading = false
      }
    },
  },
})
```

Action return types and arguments are inferred from the model definition:

```ts
const counter = store.getModel(counterModel)

counter.increment(2)
```

React can track action lifecycle with `useAction(action, options?)`, which
returns `run`, `runAsync`, local status flags, and `reset`.
