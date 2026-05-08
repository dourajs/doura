---
id: component-state
title: Using at Component Level
---

## First create a model

```tsx
import { defineModel } from 'doura'

const countModel = defineModel({
  name: 'count',
  state: {
    count: 0,
  },
  actions: {
    inc() {
      this.count += 1
    },
  },
})
```

## Then bind your components.

```tsx
import { useModel } from 'react-doura'

function Counter() {
  const counter = useModel(countModel)

  return (
    <div>
      <h1>Count: {counter.count}</h1>
      <button onClick={counter.inc}>inc</button>
    </div>
  )
}
```

## Selector

If we only care about a part of state, we should use a selector to pick exactly what we want:

```tsx
import { useModel } from 'react-doura'

const userModel = defineModel({
  name: 'user',
  state: {
    name: 'alice',
    isLogin: false,
  },
  actions: {
    login() {
      this.isLogin = true
    },
  },
})

function Login() {
  const { isLogin, login } = useModel(
    userModel,
    (s) => ({
      isLogin: s.isLogin,
      login: s.login,
    }),
    [] // deps of selector, empty means the selector function won't change
  )

  return isLogin ? <div>Welcome</div> : <button onClick={login}>Login</button>
}
```

We could also pass a pre-defined selector function instead of an inline function to eliminate the need of passing a dependencies array.

:::tip

For fully isolated per-component state (similar to `useReducer`), use `useDetachedModel` — each component instance gets its own independent model.

:::

```tsx
import { Selector } from 'react-doura'

const selector: Selector<typeof userModel> = (s) => ({
  isLogin: s.isLogin,
  login: s.login,
})

function Login() {
  const { isLogin, login } = useModel(userModel, selector)

  return isLogin ? <div>Welcome</div> : <button onClick={login}>Login</button>
}
```
