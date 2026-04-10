---
id: index
title: 'Plugins'
---

Doura provider below hooks to access model and store.

## Types

```ts
export interface PluginContext {
  doura: ModelManager
}

export type PluginHook = {
  onInit?(
    options: { initialState: Record<string, State> },
    context: PluginContext
  ): void
  onModel?(name: string, model: AnyObjectModel, context: PluginContext): void
  onModelInstance?(
    instance: ModelPublicInstance<AnyObjectModel>,
    context: PluginContext
  ): void
  onDestroy?(): void
}

export type Plugin<Option = any> = (option: Option) => PluginHook
```

## doura-plugin-log

Log action and state

### Example

```ts
import log form 'doura-plugin-log';
doura({
  plugins: [[log]],
})
```

## doura-plugin-persist

Persisting doura state, and init store state by it.

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

### Example

```js
import persist, { createWebStorage } form 'doura-plugin-persist';
doura({
  plugins: [
    [ persist,
      {
        key: 'root',
        storage: createWebStorage('local'),
        // whitelist: ['b'],
        blacklist: ['b'],
        migrate: function (storageState: any, version: number) {
          const count = storageState.count
          if (count && count.value >= 3) {
            count.value = 2
          }
          return storageState
        },
      },
    ]
  ],
})
```
