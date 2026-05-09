---
id: persist-plugin
title: Persist Plugin
---

`doura-plugin-persist` saves named model state to storage and rehydrates it when
the store starts.

## Setup

```ts
import { doura } from 'doura'
import persist, { createWebStorage } from 'doura-plugin-persist'

const store = doura({
  plugins: [
    [
      persist,
      {
        key: 'my-app',
        storage: createWebStorage('local'),
      },
    ],
  ],
})
```

`createWebStorage('local')` wraps `localStorage`; `createWebStorage('session')`
wraps `sessionStorage`. Both return the async storage interface expected by the
plugin.

## Options

```ts
interface PersistOptions {
  storage: Storage
  key: string
  blacklist?: string[]
  whitelist?: string[]
  throttle?: number
  version?: number
  migrate?: <S = any>(persistedState: S, version: number) => S | Promise<S>
  writeFailHandler?: (err: Error) => void
}
```

## Whitelist / Blacklist

Persist only selected model names with `whitelist`:

```ts
const store = doura({
  plugins: [
    [
      persist,
      {
        key: 'my-app',
        storage: createWebStorage('local'),
        whitelist: ['user', 'settings'],
      },
    ],
  ],
})
```

Persist everything except selected model names with `blacklist`:

```ts
const store = doura({
  plugins: [
    [
      persist,
      {
        key: 'my-app',
        storage: createWebStorage('local'),
        blacklist: ['ephemeral'],
      },
    ],
  ],
})
```

Only one of `whitelist` or `blacklist` should be used.

## Rehydration Status

The plugin exports `persistModel`, a detached control model initialized by the
plugin. Use it to gate rendering until storage has loaded.

```tsx
import { useModel } from 'react-doura'
import { persistModel } from 'doura-plugin-persist'

function App() {
  const persist = useModel(persistModel)

  if (!persist.rehydrated) {
    return <div>Loading...</div>
  }

  return <MainApp />
}
```

`persistModel` state:

- `rehydrated: boolean`
- `version: number`

## Schema Migration

Use `version` and `migrate` to transform older persisted state.

```ts
const store = doura({
  plugins: [
    [
      persist,
      {
        key: 'my-app',
        storage: createWebStorage('local'),
        version: 2,
        migrate(storageState, version) {
          if (version < 2) {
            const user = storageState.user
            if (user?.fullName) {
              const [firstName, lastName] = user.fullName.split(' ')
              user.firstName = firstName
              user.lastName = lastName
              delete user.fullName
            }
          }
          return storageState
        },
      },
    ],
  ],
})
```

The migration receives the stored state object keyed by model name and the
stored version. It may return the migrated state or a promise for it.

## Throttling Writes

```ts
const store = doura({
  plugins: [
    [
      persist,
      {
        key: 'my-app',
        storage: createWebStorage('local'),
        throttle: 1000,
      },
    ],
  ],
})
```

## Custom Storage

Any object implementing `Storage` can be used:

```ts
import type { Storage } from 'doura-plugin-persist'

const customStorage: Storage = {
  async getItem(key) {
    return readFromBackend(key)
  },
  async setItem(key, value) {
    await writeToBackend(key, value)
  },
  async removeItem(key) {
    await deleteFromBackend(key)
  },
}

const store = doura({
  plugins: [[persist, { key: 'my-app', storage: customStorage }]],
})
```

## Runtime Controls

`persistModel` exposes actions for runtime control:

```ts
import { persistModel } from 'doura-plugin-persist'

const persist = store.getModel(persistModel)

persist.togglePause()
await persist.flush()
await persist.purge()
```

- `togglePause()` pauses or resumes writes.
- `flush()` writes pending changes immediately.
- `purge()` removes persisted storage for the configured key.

## Write Failures

```ts
const store = doura({
  plugins: [
    [
      persist,
      {
        key: 'my-app',
        storage: createWebStorage('local'),
        writeFailHandler(error) {
          console.error('Persistence write failed:', error)
        },
      },
    ],
  ],
})
```
