---
id: multiple-stores
title: Multiple Stores
---

By default, `DouraRoot` provides a single global store. When you need **isolated state scopes** — for example, a settings panel and a dashboard that should not share state — use `createContainer` to create independent stores.

## `createContainer`

`createContainer` returns a `Provider`, `useSharedModel`, and `useStaticModel` that are scoped to their own store instance.

```ts
import { createContainer } from 'react-doura'

const {
  Provider: SettingsProvider,
  useSharedModel: useSettingsModel,
  useStaticModel: useSettingsStaticModel,
} = createContainer()

const {
  Provider: DashboardProvider,
  useSharedModel: useDashboardModel,
} = createContainer()
```

## Providing Stores

Wrap the relevant parts of your component tree with each container's `Provider`. Models accessed through one container are completely independent from those in another.

```tsx
function App() {
  return (
    <>
      <SettingsProvider>
        <SettingsPanel />
      </SettingsProvider>
      <DashboardProvider>
        <Dashboard />
      </DashboardProvider>
    </>
  )
}
```

## Using Models

Inside each provider, use the corresponding `useSharedModel` hook. The first argument is always a **name** (string).

```tsx
import { defineModel } from 'doura'

const counterModel = defineModel({
  state: { count: 0 },
  actions: {
    increment() {
      this.count++
    },
  },
})

function SettingsPanel() {
  const { count, increment } = useSettingsModel('counter', counterModel)
  // this 'counter' is isolated to SettingsProvider
  return <button onClick={increment}>Settings count: {count}</button>
}

function Dashboard() {
  const { count, increment } = useDashboardModel('counter', counterModel)
  // this 'counter' is isolated to DashboardProvider — independent from SettingsPanel
  return <button onClick={increment}>Dashboard count: {count}</button>
}
```

## Passing an External Store

You can also pass a pre-created `Doura` store to a `Provider` via the `store` prop, which is useful for SSR hydration or testing.

```tsx
import { doura } from 'doura'

const myStore = doura({
  initialState: {
    counter: { count: 42 },
  },
})

function App() {
  return (
    <SettingsProvider store={myStore}>
      <SettingsPanel />
    </SettingsProvider>
  )
}
```
