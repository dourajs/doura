---
id: optimize-views
title: Optimizing Views
---

Doura has taken a very different way to do reactivity. Fortunately, We won't need to be aware of this most of time, excepting one case.

Considering the following example:

```ts
const user = defineModel({
  state: {
    count: 0,
    user: {
      name: 'alice',
      age: 18,
    },
  },
  views: {
    userName() {
      return this.user.name
    },
  },
})
```

Ideally, the `userName` view should only re-evalute when `user.name` is changed.
But that's not how Doura works. Internally, `userName` will track the update of both `user` and `user.name`. When `user.age` has changed, it will also trigger a change event of `user`. So `userName` view has to invalidate itself and re-evalute even only `user.age` is changed.

For the sake of performance, we need to explicitly mark out the `user` from the reactivity tracking system. Here is how you can do this:

```ts
const user = defineModel({
  state: {
    count: 0,
    user: {
      name: 'alice',
      age: 18,
    },
  },
  views: {
    userName() {
      const user = this.$isolate((state) => state.user)
      return user.name
    },
  },
})
```

:::info
`$isolate()` will executes the given function in a scope where reactive values can be read, but they cannot cause the reactive scope of the caller to be re-evaluated when they change.
:::
