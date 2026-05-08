---
id: global-store
title: Global Store
---

## Provide the Doura Store to React

Wrap your app with `DouraRoot`. It creates and manages a global store automatically (you can optionally pass a pre-created store via the `store` prop).

```tsx title="index.ts"
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DouraRoot } from 'react-doura'

const root = ReactDOM.createRoot(document.getElementById('root'))

root.render(
  <DouraRoot>
    <App />
  </DouraRoot>
)
```

### Create a model

```tsx title="models/count.ts"
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

### Bind your components

Now we can use the React Doura hooks to let React components interact with the Doura store.

```tsx title="components/Counter.tsx"
import React from 'react'
import { useModel } from 'react-doura'
import { countModel } from './models/count'

export function Counter() {
  const { count, inc } = useModel(countModel)

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={inc}>inc</button>
    </div>
  )
}
```
