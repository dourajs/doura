---
id: plugins
title: Plugins
---

Plugins extend a store by registering lifecycle hooks. A plugin is a function
that receives an options object and returns hook handlers.

## Defining a Plugin

```ts
import type { Plugin } from 'doura'

const myPlugin: Plugin<{ verbose?: boolean }> = (options) => {
  return {
    onInit({ initialState }, { doura }) {
      // store created
    },
    onModel(name, model, { doura }) {
      // named model definition is being initialized
    },
    onModelInstance(instance, { doura }) {
      // named model instance was created
    },
    onDestroy() {
      // store.destroy() was called
    },
  }
}
```

## Lifecycle Hooks

| Hook                                   | Timing                                    |
| -------------------------------------- | ----------------------------------------- |
| `onInit({ initialState }, { doura })`  | Store construction.                       |
| `onModel(name, model, { doura })`      | Before a named model instance is created. |
| `onModelInstance(instance, { doura })` | After a named model instance is created.  |
| `onDestroy()`                          | When `store.destroy()` runs.              |

Detached models created with `getDetachedModel()` do not run named model
registration hooks.

## Registering Plugins

Pass plugins to `doura()` as `[plugin, options?]` tuples:

```ts
import { doura } from 'doura'

const store = doura({
  plugins: [[myPlugin, { verbose: true }]],
})
```

## Logger Plugin

`doura-plugin-log` logs each action and the model's `$rawState` after action
calls. It does not expose configuration options.

```ts
import { doura } from 'doura'
import log from 'doura-plugin-log'

const store = doura({
  plugins: [[log]],
})
```

## Persist Plugin

`doura-plugin-persist` saves named model state to a storage adapter and
rehydrates state on startup.

```ts
import persist, { createWebStorage } from 'doura-plugin-persist'

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

See the [persist guide](../guides/persist-plugin.md) for options and runtime
controls.

## Devtool Plugin

Doura exports `devtool` for Redux DevTools integration:

```ts
import { doura, devtool } from 'doura'

doura({ plugins: [[devtool]] })
```

`DouraRoot` from `react-doura` automatically injects `devtool` in development
mode.
