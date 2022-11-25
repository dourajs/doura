<div align="center">
<h1>react-doura</h1>
</div>

Doura-react includes its own hook APIs, which allow your React Components to subscribe to the doura store and dispatch actions.

- [useModel](#usemodel)
- [useRootModel](#userootmodel)
- [useRootStaticModel](#userootstaticmodel)
- [useSharedModel](#usesharedmodel)
- [useStaticModel](#usestaticmodel)

## Installation

Install with npm:

```
npm install react-doura
```

Install with yarn

```
yarn add react-doura
```

## Usage

### Use different hooks depends on the scenario

Doura offers multiple hooks for different situations.

`useModel` would be the first choice if there is no suitable hooks to choose.

`useRootModel` aims to store global variable that offers for all react components.

`useRootStatic` aims to store global static data, such as environment variable, only get it at first time.

`useSharedModel` allows you to share data across specific components, not globally but locally.

`useStaticModel` allows you to share local static data across specific components.

## Examples

### Global state management


1. Using `<DouraRoot />` component, which makes the state shared by the rest of your app:

```tsx
// src/index.ts
import * as React from 'react'
import ReactDOM from 'react-dom'
import { DouraRoot } from 'react-doura'
import App from './App'

function App() {
  return ReactDOM.render(
    <DouraRoot>
      <App />
    </DouraRoot>,
    document.getElementById('root')
  )
}
```

1. Define a model:

```ts
// src/model.ts
export const user = defineModel({
  name: 'user',
  state: { name: 'alice', isLogin: false },
  actions: {
    login() {
      this.login = true
    },
  },
})
```

3. Use hooks to consume the model:

```tsx
// src/App.tsx
import * as React from 'react'
import {
  ISelectorParams,
  createContainer,
  useRootModel,
} from 'react-doura'
import { user } from './model'

const selector = function (data: ISelectorParams<typeof user>) {
  return data.isLogin
}

export default function App() {
  const [isLogin, { login }] = useRootModel(user, selector)
  return isLogin ? <div>welcome</div> : <div onClick={login}>login</div>
}
```

## Use Doura in a subtree of your app

```tsx src/ComponentWithSharedModel.tsx
import * as React from 'react';
import ReactDOM from 'react-dom';
import { createContainer } from 'react-doura';

const { Provider: LocalProvider, useSharedModel, useStaticModel } = createContainer();

function ComponentA() {
    const [state, actions] = usesharedModel(user);
    const [staticState, _] = useStaticModel(user);
    return (
        ...
    )
}

function ComponentB() {
    const [state, actions] = usesharedModel(user);
    const [staticState, _] = useStaticModel(user);
    return (
        ...
    )
}

export default function ComponentWithSharedModel() {
    return (
        <LocalProvider>
            <ComponentA />
            <ComponentB />
        </LocalProvider>
    )
}
```

## Component level

We can replace all `useState`, `useReducer`,  `useMemo` and `useCallback` calls by using `useModel`.

```tsx
import { useModel } from 'react-doura'

function Counter() {
  const [state, actions] = useModel({
    state: {
      count: 0,
    },
    actions: {
      increment() {
        this.count += 1
      },
      decrement() {
        this.count -= 1
      },
    },
  })

  return (
    <>
      Count: {state.count}
      <button onClick={actions.decrement}>-</button>
      <button onClick={actions.increment}>+</button>
    </>
  )
}
```

## API

### useModel()

```tsx
import { useModel } from 'react-doura';
const [state, actions] = useModel(model: IModel, selector?: ISelector);
```

Most of time you would use `useModel` to extract data from the model. It will create new context everytime you use it.

### useRootModel()

```tsx
import { useRooteModel } from 'react-doura';
const [state, actions] = useRooteModel(model: IModel, selector?: ISelector);
```

Global `Provider` context, you can get the global context anywhere, even if the component is unmount, the state will not be destroyed.

### useRootStaticModel()

```tsx
import { useRootStaticModel } from 'react-doura';
const [state, actions] = useRootStaticModel(model: IModel, selector?: ISelector);
```

`useRootStaticModel` is similar to `useRootModel`, the different is that, `useRootStaticModel` will not rerender on state changed.

### createContainer()

It returns a independent scope `Provider, useSharedModel, useStaticModel` for context and methods to consume models.

```ts title="shared"
import { createContainer } from 'react-doura'
export const { Provider, useSharedModel, useStaticModel } = createContainer()
```

#### Provider

In the same `Provider` context, the state is shared across the store

#### useSharedModel()

```tsx
const [state, actions] = useSharedModel(model: IModel, selector?: ISelector);
```

Share the context across components

#### useStaticModel()

```tsx
const [state, actions] = useStaticModel(model: IModel, selector?: ISelector);
```

`useStaticModel` is similar to `useSharedModel`, the different is that, `useStaticModel` will not rerender on state changed.

> `useStaticModel` doest not support [Destructuring Assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment).

## Plugin

```tsx src/plugin.tsx
import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import { doura } from 'doura'
import douraLog from 'doura-log'
import persist, { createWebStorage } from 'doura-persist'
import { DouraRoot } from 'react-doura'

const modelManager = doura({
  initialState: {},
  plugins: [
    [douraLog],
    [
      persist,
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
    ],
  ],
})

ReactDOM.render(
  <DouraRoot modelManager={modelManager}>
    <App />
  </DouraRoot>,
  document.getElementById('root')
)
```
