---
id: global-store
title: Global Store
---

`DouraRoot` provides the default React store used by `useModel` and
`useStaticModel`. In development mode it automatically enables the `devtool`
plugin.

```tsx title="index.tsx"
import React from 'react'
import ReactDOM from 'react-dom/client'
import { DouraRoot } from 'react-doura'
import { App } from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <DouraRoot>
    <App />
  </DouraRoot>
)
```

## Create a Model

```ts title="models/count.ts"
import { defineModel } from 'doura'

export const countModel = defineModel({
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

## Use the Model

```tsx title="components/Counter.tsx"
import { useModel } from 'react-doura'
import { countModel } from '../models/count'

export function Counter() {
  const { count, inc } = useModel(countModel)

  return <button onClick={inc}>Count: {count}</button>
}
```

You can pass an existing store for SSR or tests:

```tsx
import { doura } from 'doura'

const store = doura({
  initialState: {
    count: { count: 10 },
  },
})

<DouraRoot store={store}>
  <App />
</DouraRoot>
```
