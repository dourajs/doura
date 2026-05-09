---
id: installation
title: Installation
---

Install the packages you use. The repository itself is a pnpm workspace, but
applications can use any package manager.

```bash
pnpm add doura
pnpm add react-doura
```

```bash
yarn add doura react-doura
npm install doura react-doura
```

`react-doura` requires `react >=18` and a matching `doura` peer. Current Doura
packages are `0.2.0-beta.0`.

## Core Usage

```ts
import { defineModel, doura } from 'doura'

export const countModel = defineModel({
  name: 'count',
  state: {
    count: 0,
  },
  actions: {
    increment(n = 1) {
      this.count += n
    },
    reset() {
      this.$state = { count: 0 }
    },
  },
  views: {
    isZero() {
      return this.count === 0
    },
  },
})

const store = doura({
  initialState: {
    count: { count: 10 },
  },
})

const count = store.getModel(countModel)

count.increment()
console.log(count.count) // 11
console.log(count.isZero) // false
```

`getModel(model)` uses `model.name` as the store key. Repeated calls with the
same named model in one store return the same instance. Different stores keep
independent instances.

## React Usage

```tsx
import { DouraRoot, useModel } from 'react-doura'
import { countModel } from './models/count'

function Counter() {
  const count = useModel(countModel)

  return <button onClick={() => count.increment()}>Count: {count.count}</button>
}

export function App() {
  return (
    <DouraRoot>
      <Counter />
    </DouraRoot>
  )
}
```

`useModel` does not take a separate name and does not return a tuple. It returns
the model API directly: state, views, actions, query handles, and child models
are flattened onto one object.
