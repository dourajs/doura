---
id: compose-model
title: Composing Models
---

Use the `models` option to compose models. Each child model is mounted by its
own `name`, and is available on the parent instance and on `$models`.

```ts
const countModel = defineModel({
  name: 'counter',
  state: {
    count: 0,
  },
  actions: {
    inc() {
      this.count++
    },
  },
})

const userModel = defineModel({
  name: 'user',
  state: {
    name: 'alice',
    isLogin: false,
  },
  models: [countModel],
  actions: {
    login() {
      this.counter.inc()
      this.isLogin = true
    },
  },
  views: {
    loginCount() {
      return this.counter.count
    },
  },
})
```

Outside the model, the same child is available through both flattened access
and `$models`:

```ts
const user = douraStore.getModel(userModel)

user.counter.inc()
user.$models.counter.inc()
```

:::caution
Child model keys come from `childModel.name`. Avoid reusing a child name that
conflicts with parent state, action, view, or query keys.
:::

## Shared Instances

Named models are shared by the model manager. If multiple parents compose the
same child model, they point to the same child instance for that manager.

```ts
const modelOne = defineModel({
  name: 'one',
  state: { value: 0 },
  models: [countModel],
})

const modelTwo = defineModel({
  name: 'two',
  state: { value: 0 },
  models: [countModel],
})
```

`modelOne.counter` and `modelTwo.counter` refer to the same `counter` instance
when both parents are created from the same doura store.
