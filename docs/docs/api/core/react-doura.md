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

`selectors` can choose which property needed, and it's depends. 

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

  Provider: DouraRoot,
  useSharedModel: useRootModel,
  useStaticModel: useRootStaticModel,

## DouraRoot

Provider context for `useRootModel` and `useRootStaticModel`.

```tsx

```

## dynamic

Use `dynamic()` to lazy loading external libraries with `import()` and React components.
Deferred loading helps improve the initial loading performance by decreasing the amount of JavaScript necessary to render the page. Components or libraries are only imported and included in the JavaScript bundle when they're used.

### Type

```ts
type Loader<P> = Promise<React.ComponentType<P>>

interface DynamicOptions {
  loading?: ({ error, isLoading, pastDelay }: {
      error?: Error | null;
      isLoading?: boolean;
      pastDelay?: boolean;
      timedOut?: boolean;
  }) => JSX.Element | null;
  loader?: Loader<P>;
  ssr?: boolean;
}

function dynamic<Props = {}>(
  loader: () => Loader<Props>
  options?: DynamicOptions<Props>
): React.ComponentType<Props>;
```

### Example

```tsx
import dynamic from '@shuvi/runtime'
import { Suspense } from 'react'

const DynamicHeader = dynamic(() => import('../components/header'), {
  loading: () => <div>Loading...</div>,
})

export default function Home() {
  return <DynamicHeader />
}
```
