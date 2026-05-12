---
id: multiple-stores
title: Multiple Stores
---

Use `createContainer(options?)` when part of the React tree needs an isolated
store. It returns `{ Provider, useSharedModel, useStaticModel, useQuery, useAction, useInfiniteQuery }`.

```tsx
import { createContainer } from 'react-doura'

const {
  Provider: SettingsProvider,
  useSharedModel: useSettingsModel,
  useStaticModel: useSettingsStaticModel,
  useQuery: useSettingsQuery,
} = createContainer()

const { Provider: DashboardProvider, useSharedModel: useDashboardModel } =
  createContainer()
```

## Providers

Each provider owns its own store unless you pass an external `store` prop.

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

## Scoped Hooks

```tsx
import { defineModel } from 'doura'

const counterModel = defineModel({
  name: 'counter',
  state: { count: 0 },
  actions: {
    increment() {
      this.count += 1
    },
  },
})

function SettingsPanel() {
  const { count, increment } = useSettingsModel(counterModel)
  return <button onClick={increment}>Settings count: {count}</button>
}

function Dashboard() {
  const { count, increment } = useDashboardModel(counterModel)
  return <button onClick={increment}>Dashboard count: {count}</button>
}
```

`SettingsPanel` and `Dashboard` read the same model definition, but the
instances are isolated because they come from different container stores.

## External Store

```tsx
import { doura } from 'doura'

const store = doura({
  initialState: {
    counter: { count: 42 },
  },
})

function App() {
  return (
    <SettingsProvider store={store}>
      <SettingsPanel />
    </SettingsProvider>
  )
}
```

`createContainer(options?)` forwards its options to `doura()` when the provider
creates an internal store.
