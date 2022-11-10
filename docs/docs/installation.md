---
id: installation
title: Installation
---

Install doura with your favorite package manager:

```bash
yarn add doura
# or with npm
npm install doura
```

## Usage

### Define models

A **Model** is an entity holding state and business logic that isn't bound to your Components. It's a bit like a component that is always there and that everybody can read off and write to. It has three concepts, the [state](./core-concepts/state.md), [views](./core-concepts/views.md) and [actions](./core-concepts/actions.md).

```ts title="src/models/count.ts"
export const count = defineModel({
  // initial state
  state: {
    count: 0,
  },
  actions: {
    // handle state changes
    increment(n: number) {
      this.count += n
    },
    // use async/await for async actions
    async incrementAsync(n: number) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      this.increment()
    },
  },
  views: {
    // derived value from state, value is cached and computed on-demand
    isZero() {
      return this.count === 0
    },
  },
})
```

### Consume models

Store is used to init and persist the state of a model. We can have multiple stores at the same time. 

```ts title="src/store.ts"
import { doura } from 'doura';
import { count } from './models/count';

const storeA = doura();
const storeB = doura();

const modelInstanceA = storeA.getModel(count)

// model will only be inited once within a store
console.log(storeA.getModel(count) === modelInstanceA) // true

const modelInstanceB = storeB.getModel(count)

console.log(modelInstanceA.count) // 0
console.log(modelInstanceA.isZero) // true
console.log(modelInstanceB.count) // 0

modelInstanceA.increment();
console.log(modelInstanceA.count) // 1
console.log(modelInstanceA.isZero) // false
console.log(modelInstanceB.count) // 0

await modelInstanceB.incrementAsync();
console.log(modelInstanceB.count) // 1
console.log(modelInstanceB.isZero) // false
```
