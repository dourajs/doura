---
id: index
title: Plugins
---

## Core Plugin Types

```ts
export interface PluginContext {
  doura: ModelManager
}

export type PluginHook = {
  onInit?(
    options: { initialState: Record<string, State> },
    context: PluginContext
  ): void
  onModel?(name: string, model: Model, context: PluginContext): void
  onModelInstance?(
    instance: ModelInstance<ModelDefinition<Model>>,
    context: PluginContext
  ): void
  onDestroy?(): void
}

export type Plugin<Option = any> = (option: Option) => PluginHook
```

Register plugins with `doura({ plugins: [[plugin, options?]] })`.

## doura-plugin-log

`doura-plugin-log` listens to `$onAction` for each named model instance and
prints the action plus the instance `$rawState`.

```ts
import { doura } from 'doura'
import log from 'doura-plugin-log'

doura({
  plugins: [[log]],
})
```

The log plugin does not currently expose configuration options.

## doura-plugin-persist

The persist plugin stores `store.getState()` in an async storage adapter,
rehydrates named models, and exposes `persistModel` for runtime status and
controls.

### Types

```ts
export interface Storage {
  getItem(key: string, ...args: Array<any>): Promise<any>
  setItem(key: string, value: any, ...args: Array<any>): Promise<any>
  removeItem(key: string, ...args: Array<any>): Promise<any>
}

export interface PersistOptions {
  storage: Storage
  key: string
  blacklist?: Array<string>
  whitelist?: Array<string>
  throttle?: number
  version?: number
  migrate?: <S = any>(persistedState: S, version: number) => S | Promise<S>
  writeFailHandler?: (err: Error) => void
}
```

### Exports

```ts
import persist, {
  createWebStorage,
  persistModel,
  type PersistOptions,
  type Storage,
} from 'doura-plugin-persist'
```

- `createWebStorage('local' | 'session')` wraps browser storage with the async
  `Storage` interface.
- `persistModel` has `rehydrated` and `version` state plus `purge()`,
  `flush()`, and `togglePause()` actions.

### Example

```ts
import { doura } from 'doura'
import persist, { createWebStorage } from 'doura-plugin-persist'

doura({
  plugins: [
    [
      persist,
      {
        key: 'root',
        storage: createWebStorage('local'),
        blacklist: ['ephemeral'],
        version: 2,
        migrate(storageState, version) {
          return storageState
        },
        writeFailHandler(error) {
          console.error(error)
        },
      },
    ],
  ],
})
```
