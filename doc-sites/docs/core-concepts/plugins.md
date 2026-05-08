---
id: plugins
title: Plugins
---

Plugins extend the behavior of a Doura store by hooking into lifecycle events. A plugin is a function that receives an option argument and returns a `PluginHook` object.

## Defining a Plugin

```ts
import { Plugin } from 'doura'

const myPlugin: Plugin<{ verbose?: boolean }> = (option) => {
  return {
    onInit({ initialState }, { doura }) {
      // called once when the store is created
    },
    onModel(name, model, { doura }) {
      // called when a model definition is first registered
    },
    onModelInstance(instance, { doura }) {
      // called when a model instance is created
    },
    onDestroy() {
      // called when store.destroy() is invoked
    },
  }
}
```

## Lifecycle Hooks

| Hook | Timing | Parameters |
|------|--------|------------|
| `onInit` | Store is created | `{ initialState }`, `PluginContext` |
| `onModel` | Model definition is registered | `name`, `model`, `PluginContext` |
| `onModelInstance` | Model instance is created | `instance`, `PluginContext` |
| `onDestroy` | `store.destroy()` is called | — |

`PluginContext` provides access to the store via `{ doura: ModelManager }`.

## Registering Plugins

Pass plugins to `doura()` as an array of `[plugin, options?]` tuples:

```ts
import { doura } from 'doura'
import { myPlugin } from './plugins/myPlugin'

const store = doura({
  plugins: [
    [myPlugin, { verbose: true }],
  ],
})
```

## Example: Action Logger

```ts
import { Plugin } from 'doura'

const actionLogger: Plugin = () => ({
  onModelInstance(instance) {
    instance.$onAction((action) => {
      console.log(`[${instance.$name}] ${action.name}`, action.args)
    })
  },
})

const store = doura({
  plugins: [[actionLogger]],
})
```

## Built-in Devtool Plugin

Doura ships with a devtool plugin that connects to the [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools). When using `react-doura`, `DouraRoot` automatically enables this plugin in development mode — no manual setup needed.

For non-React usage, you can enable it manually:

```ts
import { doura, devtool } from 'doura'

const store = doura({
  plugins: [[devtool]],
})
```
