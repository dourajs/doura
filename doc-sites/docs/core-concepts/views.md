---
id: views
title: Views
---

Views are computed values declared under `views`. They are cached and
recomputed when the state, view, or child-model values they read change.

```ts
import { defineModel } from 'doura'

export const counterModel = defineModel({
  name: 'counter',
  state: {
    count: 0,
  },
  views: {
    double(state) {
      return state.count * 2
    },
    doublePlusOne() {
      return this.double + 1
    },
  },
})
```

Use the `state` parameter for simple state-only derivations. Use a regular
function and `this` when a view needs other views or child models.

```ts
const counter = store.getModel(counterModel)

console.log(counter.double)
console.log(counter.$views.double)
```

Views are readonly. Mutate state in actions, not in views.
