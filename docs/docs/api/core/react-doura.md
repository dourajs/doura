---
id: react-doura
title: React Doura
---

## useModel

### Types

```ts
declare interface UseModel extends UseAnonymousModel, UseNamedModel {}
```

:::caution
With the param `name` or not, `useModel` has very different behavior.
:::

## useModel Without Name

`useModel` can replace `useState`, and enjoy doura features.

### Types

```ts
declare interface UseAnonymousModel {
  <IModel extends AnyModel>(model: IModel): ModelAPI<IModel>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}
```

### Example

Easy to replace `useState`, no need care about warp `add` with `useCallback`.

```js
const count = defineModel({
  state: {
    value: 1,
  },
  actions: {
    add(payload: number = 1) {
      this.value += payload
    },
  },
})
const App = () => {
  const counter = useModel(count)

  return (
    <>
      <div id="value">{counter.value}</div>
      <button id="button" type="button" onClick={() => counter.add()}>
        add
      </button>
    </>
  )
}
```

Use selector to pick exact what we want

### Selector Types

```ts
type Selector<Model extends AnyModel, TReturn = any> = (
  api: ModelAPI<Model>,
  actions: ModelActions<Model>
) => TReturn
```

#### Example

```ts
import { Selector } from 'react-doura'
const countSelector: Selector<
  typeof countModel,
  { count: number; add: () => void }
> = (s, actions) => {
  return { count: s.count, add: actions.add }
}
```

```ts
import { ModelAPI， ModelActions } from 'doura'
const countSelector = (
  s: ModelAPI<typeof countModel>,
  actions: ModelActions<typeof countModel>
) => {
  return { count: s.count, add: actions.add }
}
```

when depends not changed, the `selectors` function will be old one, it works like `useCallback`.

```tsx
const countModel = defineModel({
  state: {
    value: 1,
  },
  actions: {
    add(payload: number = 1) {
      this.value += payload
    },
    async asyncAdd(n: number) {
      await sleep(200)
      this.add(n)
    },
  },
  views: {
    test() {
      return this.value + 1
    },
  },
})

const App = () => {
  const counter = useModel(
    countModel,
    (state, actions) => {
      return {
        value: state.value,
        test: state.test,
        ...actions,
      }
    },
    []
  )

  return (
    <>
      <div id="v">{counter.value}</div>
      <div id="t">{counter.test}</div>
      <button id="button" type="button" onClick={() => counter.add(2)}>
        add
      </button>
    </>
  )
}
```

## DouraRoot

Provider context for `useModel` and `useStaticModel`.

### Types

```ts
declare const DouraRoot: (
  props: PropsWithChildren<{
    store?: Doura
  }>
) => JSX.Element
```

### Example

```tsx
<DouraRoot store={doura()}>
  <App />
</DouraRoot>
```

## useModel With Name

Get global state by anywhere.

### Types

```ts
declare interface UseNamedModel {
  <IModel extends AnyModel>(name: string, model: IModel): ModelAPI<IModel>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    name: string,
    model: IModel,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}
```

### Example

```tsx
const App = () => {
  const counter = useModel(
    'count',
    countModel,
    (s, actions) => {
      fn()
      return { count: s.count, add: actions.add }
    },
    []
  )

  return (
    <button id="count" onClick={() => counter.add()}>
      {counter.count}
    </button>
  )
}
```

## useStaticModel

:::caution
State change will not trigger render.
:::

### Types

```ts
declare interface UseStaticModel {
  <IModel extends AnyModel>(name: string, model: IModel): ModelAPI<IModel>
}
```

### Example

```tsx
const model = defineModel({
  state: { value: 1 },
  views: {
    test() {
      return this.value * 2
    },
  },
})

const App = () => {
  const state = useStaticModel('test', model)

  return (
    <>
      <div id="v">{state.value}</div>
      <div id="t">{state.test}</div>
    </>
  )
}
```

## createContainer

Create a group api for share states.

### Types

```ts
declare const createContainer: (options?: DouraOptions) => {
  Provider: (
    props: PropsWithChildren<{
      store?: Doura
    }>
  ) => JSX.Element
  useSharedModel: UseNamedModel
  useStaticModel: UseStaticModel
}
```
### Example

```ts
const {
  Provider, // context as same as DouraRoot
  useSharedModel, // as same as useModel and it first param must be `name`
  useStaticModel, // as same as useStaticModel
} = createContainer()
```
