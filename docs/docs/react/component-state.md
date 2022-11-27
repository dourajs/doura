---
id: component-state
title: Using at Component Level
---

## First create a model

```tsx
import { defineModel } from 'doura'

const countModel = defineModel({
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

If we only care a part of states, we should use selecotr to pick exact what we want:

```tsx
import { useModel } from 'react-doura'

const userModel = defineModel({
  state: {
    name: 'aclie',
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
    [] // deps of selector, empty means the seletor function won't change
  )

  return isLogin ? <div>Welcome</div> : <button onClick={login}>Login</button>
}
```

We could also pass a pre-defined selector function insteand of an inline function to eliminate the need of passing a dependencies array.

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
