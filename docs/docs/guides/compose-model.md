---
id: compose-model
title: Composing Models
---

To use other models when define a model, we need to use **function** to define
the model.

```ts
import { use } from 'doura';

const countModel = defineModel({
  state: {
    count: 0,
  },
})

const userModel = defineModel(() => {
  const counter = use(countModel)

  return {
    state: {
      name: 'alice',
      isLogin: false,
    },
    actions: {
      login() {
        counter.count++
        this.isLogin = true
      },
    },
    views: {
      loginCount() {
        return counter.count
      },
    },
  }
})
```

:::caution
Note that if you destructure the `counter` object, the destructured variables will lose reactivity. It is therefore recommended to always access props in the form of `counter.xxx`.
:::

```ts
import { use } from 'doura';

const userModel = defineModel(() => {
  const counter = use(countModel)
  const { count } = counter // ❌ don't destructure

  return {
    state: {},
    views: {
      countOne() {
        return count; // ⚠️ countOne won't update even count has changed
      }
      countTwo() {
        return counter.count // ✅ always access props by `someModel.xx` in a view function
      },
    },
  }
})
```

## Local Model

when composing a model by `use(model)`, if we don't provide a name, the model is isolated and can only get accessed in the current model.

```ts
import { use } from 'doura';

const countModel = defineModel({
  state: {
    count: 0,
  },
})

const modelOne = defineModel(() => {
  const counter1 = use(countModel)
  const counter2 = use(countModel)

  return {
    state: {
      value: 0,
    },
  }
})

const modelTwo = defineModel(() => {
  const counter3 = use(countModel)

  return {
    state: {
      value: 0,
    },
  }
})
```

`counter1`, `counter2` and `counter3` are three different instances. They are independent of each other and do not affect each other.

## Named Model

If you want to share a model's state among other models, you need use **named model**.

```ts
import { use } from 'doura';

const countModel = defineModel({
  state: {
    count: 0,
  },
})

const modelOne = defineModel(() => {
  const counter1 = use('counter', countModel)

  return {
    state: {
      value: 0,
    },
  }
})

const modelTwo = defineModel(() => {
  const counter2 = use('counter', countModel) // counter1 and counter2 point to a same instance as long as they have a same name.

  return {
    state: {
      value: 0,
    },
  }
})
```
