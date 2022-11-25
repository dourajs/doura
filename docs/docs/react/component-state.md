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
import { useModel } from 'doura-react'

function Counter() {
  const [state, actions] = useModel(countModel)

  return (
    <div>
      <h1>Count: {state.count}</h1>
      <button onClick={actions.inc}>inc</button>
    </div>
  )
}
```

## Selector

If we only care a part of states, we should use selecotr to pick exact what we want:

```tsx
import { useModel } from 'doura-react'

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
  const [isLogin, actions] = useModel(userModel, (s) => s.isLogin)

  return isLogin ? (
    <div>Welcome</div>
  ) : (
    <button onClick={actions.login}>Login</button>
  )
}
```
