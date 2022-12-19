---
id: doura
title: Doura
---

## State

```ts
type StateObject = {
  [x: string]: any
}
```

## Action

```ts
type ActionOptions = Record<string, Function>
```

#### Example

```tsx
const count = defineModel({
  state: { value: 0 },
  actions: {
    add(p: number) {
      this.value += p
    },
    nested() {
      this.add(1)
    },
    async asyncAction(): Promise<void> {
      this.value += 1
      await timeout(1000)
      this.value += 1
    },
    changeStateBy$state(n: number) {
      this.$state.value += n
    },
    changeStateByReturnValue() {
      return { value: 2 }
    },
  },
```

## View

```ts
type ViewOptions<State = any> = Record<
  string,
  ((s: State) => any) | (() => any)
>
```

#### Example

```tsx
const count = defineModel({
  state: {
    count: 1,
  },
  views: {
    double(s) {
      return s.count * 2
    },
    doubleByThis() {
      return this.count * 2
    },
    nested() {
      this.double
    },
  },
})
```

## `defineModel`

There is two ways define a model, object or function.

### Types

```ts
export type DefineModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  P extends Params
> = ModelOptions<S, A, V, P> & {}
```

### `defineModel` By Object

The basic way to define model.

```tsx
const countModel = defineModel({
  state: { count: 1 },
  actions: {
    add(p: number) {
      this.count += p
    },
  },
  views: {
    double() {
      return this.count * 2
    },
  },
})
```

### `defineModel` By Function

Defined model, and defined it's depends.

```ts
const countModel = defineModel({
  state: { count: 1 },
  actions: {
    add(p: number) {
      this.count += p
    },
  },
  views: {
    double() {
      return this.count * 2
    },
  },
})

const model = defineModel(({ use }) => {
  const count = use('count', countModel)
  return {
    state: { value: 0 },
    actions: {
      add(p: number) {
        this.value += p
      },
    },
    views: {
      all() {
        return {
          value: this.value,
          depDouble: count.double,
        }
      },
    },
  }
})
```

## `doura`

For create a modelManager.

### Types

```ts
function doura({ initialState, plugins = [] }): Doura
```

### Example

```ts
const store = doure({
  initialState: {
    counter: {
      count: 100,
    },
  },
})

const modelInstance = store.getModel('counter', counterModel)

console.log(modelInstance.count) // 100
```

## `ModelInstance`

Get model state, call actions and views.

### Example

```ts
const store = doura()
const model = defineModel({
  state: { value: 0 },
  actions: {
    actionOne() {
      // ...change state
    },
  },
  views: {
    viewOne() {},
  },
})

const modelInstance = store.getModel('test', model)
modelInstance.$state // { value: 0 }
modelInstance.actionOne() // undefined
modelInstance.viewOne // undefined
```
