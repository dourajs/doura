---
id: react-doura
title: React Doura
---

## useModel

`useModel` can replace `useState`, and enjoy doura features.

### Type

```ts
interface UseModel {
  <IModel extends AnyModel>(model: IModel, depends?: any[]): ModelAPI<IModel>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}
```

### Example

sample to replace `useState`, no need care about warp with `useCallback`.

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

Use selecotr to pick exact what we want

### Selectors Type

```ts
type Selector<Model extends AnyModel, TReturn = any> = (
  api: ModelAPI<Model>,
  actions: ModelActions<Model>
) => TReturn
```

```ts
import { ModelData } from 'doura'
type countSelectorParameters = ModelData<typeof countModel>
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

Provider context for `useRootModel` and `useRootStaticModel`.

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

## useRootModel

Get global state by anywhere.

```ts
declare interface UseNamedModel {
  <IModel extends AnyModel>(
    name: string,
    model: IModel,
    depends?: any[]
  ): ModelAPI<IModel>
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
  const counter = useRootModel(
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
## useRootStaticModel

Apis is same as `useRootModel`. 

:::info
State change will not trigger render.
:::

## createContainer

Create a group api for share states.

```ts
declare const createContainer: (options?: DouraOptions) => {
    Provider: (props: PropsWithChildren<{
        store?: Doura;
    }>) => JSX.Element;
    useSharedModel: UseNamedModel;
    useStaticModel: UseNamedStaticModel;
};
```

```ts
const {
  Provider, // context as same as DouraRoot
  useSharedModel, // as same as useRootModel
  useStaticModel, // as same as useRootStaticModel
} = createContainer()
```