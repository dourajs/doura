---
id: global-store
title: Global Store
---

## Create a Doura sotre

```tsx title="store.ts"
import { doura } from 'doura'

export default doura()
```

## Provide the Doura Store to React

```tsx title="index.ts"
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import store from './store'
import { DouraRoot } from 'react-doura'

// As of React 18
const root = ReactDOM.createRoot(document.getElementById('root'))

root.render(
  <DouraRoot store={store}>
    <App />
  </DouraRoot>
)
```

### Create a model

```tsx title="models/count"
import { defineModel } from 'doura'

export const countModel = defineModel({
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

```tsx title="componnets/Counter.tsx"
import React from 'react'
import { useRootModel } from 'react-doura'
import { countModel } from './models/count'

export function Counter() {
  const [state, actions] = useRootModel('count', countModel)

  return (
    <div>
      <h1>Count: {state.count}</h1>
      <button onClick={actions.inc}>inc</button>
    </div>
  )
}
```
