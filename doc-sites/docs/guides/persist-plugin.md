---
id: persist-plugin
title: Persist Plugin
---

The `doura-plugin-persist` plugin saves model state to storage and rehydrates it on startup.

## Setup

```ts
import { doura } from 'doura'
import persist, { createWebStorage } from 'doura-plugin-persist'

const store = doura({
  plugins: [
    [persist, {
      key: 'my-app',
      storage: createWebStorage('local'),
    }],
  ],
})
```

`createWebStorage` accepts `'local'` or `'session'` to wrap `localStorage` or `sessionStorage` in the required async interface.

## Whitelist / Blacklist

Control which models are persisted by name:

```ts
[persist, {
  key: 'my-app',
  storage: createWebStorage('local'),
  whitelist: ['user', 'settings'],  // only persist these models
}]

// OR

[persist, {
  key: 'my-app',
  storage: createWebStorage('local'),
  blacklist: ['ephemeral'],  // persist everything except these
}]
```

Only one of `whitelist` or `blacklist` should be used. If `whitelist` is provided, only those models are persisted. If `blacklist` is provided, all models except those listed are persisted.

## Checking Rehydration Status

The plugin exposes a `persistModel` that tracks rehydration state. Use it to gate rendering until storage is loaded:

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
- `rehydrated: boolean` — becomes `true` once stored state has been read and applied
- `version: number` — the current schema version

## Schema Migration

When your state shape changes across app versions, use `version` and `migrate` to transform old persisted data:

```ts
[persist, {
  key: 'my-app',
  storage: createWebStorage('local'),
  version: 2,
  migrate(storageState, version) {
    if (version < 2) {
      // Transform v1 state to v2 shape
      const user = storageState.user
      if (user && user.fullName) {
        user.firstName = user.fullName.split(' ')[0]
        user.lastName = user.fullName.split(' ')[1]
        delete user.fullName
      }
    }
    return storageState
  },
}]
```

The `migrate` function receives the entire stored state object (keyed by model name) and the persisted version number. It can return synchronously or return a Promise.

## Throttling Writes

To avoid excessive storage writes, set a `throttle` value in milliseconds:

```ts
[persist, {
  key: 'my-app',
  storage: createWebStorage('local'),
  throttle: 1000,  // write at most once per second
}]
```

## Custom Storage Adapter

Any object implementing the `Storage` interface can be used:

```ts
import { Storage } from 'doura-plugin-persist'

const customStorage: Storage = {
  async getItem(key) {
    // read from your storage backend
  },
  async setItem(key, value) {
    // write to your storage backend
  },
  async removeItem(key) {
    // delete from your storage backend
  },
}

[persist, {
  key: 'my-app',
  storage: customStorage,
}]
```

## Controlling Persistence at Runtime

The `persistModel` instance exposes actions for runtime control:

```ts
import { persistModel } from 'doura-plugin-persist'

const persist = store.getModel(persistModel)

// Pause/resume persistence writes
persist.togglePause()

// Flush pending writes immediately
await persist.flush()

// Purge all persisted state from storage
await persist.purge()
```

## Error Handling

Handle storage write failures with `writeFailHandler`:

```ts
[persist, {
  key: 'my-app',
  storage: createWebStorage('local'),
  writeFailHandler(err) {
    console.error('Persistence write failed:', err)
    // e.g. notify user, fall back to memory-only
  },
}]
```
