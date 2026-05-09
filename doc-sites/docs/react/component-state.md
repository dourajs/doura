---
id: component-state
title: Component State
---

Use `useModel(model, selector?, depends?)` inside a `DouraRoot` tree when the
component should read or update the shared store.

```tsx
import { defineModel } from 'doura'
import { useModel } from 'react-doura'

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

function Counter() {
  const counter = useModel(countModel)

  return <button onClick={() => counter.inc()}>Count: {counter.count}</button>
}
```

`useModel` returns the model API directly. It does not take a separate name and
does not return a tuple.

## Selectors

Use a selector when a component only needs part of the model API:

```tsx
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
    (api, actions) => ({
      isLogin: api.isLogin,
      login: actions.login,
    }),
    []
  )

  return isLogin ? <div>Welcome</div> : <button onClick={login}>Login</button>
}
```

The optional `depends` array controls when an inline selector is recreated. For
a module-level selector, no dependency array is needed:

```tsx
import type { Selector } from 'react-doura'

const selector: Selector<typeof userModel> = (api, actions) => ({
  isLogin: api.isLogin,
  login: actions.login,
})

function Login() {
  const { isLogin, login } = useModel(userModel, selector)
  return isLogin ? <div>Welcome</div> : <button onClick={login}>Login</button>
}
```

## Isolated Component State

Use `useDetachedModel` when each component instance should own an independent
model store:

```tsx
import { useDetachedModel } from 'react-doura'

function LocalCounter() {
  const counter = useDetachedModel(countModel)

  return (
    <button onClick={() => counter.inc()}>Local count: {counter.count}</button>
  )
}
```

Detached models are not included in a parent store's `getState()`.
