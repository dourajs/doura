---
id: typescript
title: TypeScript
---

Doura infers state, actions, views, child models, and query handles from
`defineModel()`. Use `strict` or at least `noImplicitThis` so action and view
`this` types are checked.

## State Shape

Use assertions for empty arrays and nullable values:

```ts
interface User {
  id: string
  name: string
}

export const userModel = defineModel({
  name: 'user',
  state: {
    users: [] as User[],
    currentUser: null as User | null,
  },
})
```

You can also cast the whole state object:

```ts
interface UserState {
  users: User[]
  currentUser: User | null
}

export const userModel = defineModel({
  name: 'user',
  state: {
    users: [],
    currentUser: null,
  } as UserState,
})
```

## Public Utility Types

```ts
import type {
  ModelState,
  ModelActions,
  ModelViews,
  ModelQueries,
  ModelModels,
  ModelInstance,
  QueryHandle,
  Selector,
} from 'doura'
```

These types derive public API shapes from a model definition:

```ts
type UserState = ModelState<typeof userModel>
type UserActions = ModelActions<typeof userModel>
type UserViews = ModelViews<typeof userModel>
type UserQueries = ModelQueries<typeof userModel>
type UserInstance = ModelInstance<typeof userModel>
```

## Query Inference

Query entries are functions. Doura infers the args tuple and data type from the
function signature:

```ts
const userModel = defineModel({
  name: 'user',
  state: { currentUser: null as User | null },
  queries: {
    fetchUser(ctx, id: string) {
      return api.fetchUser(id, { signal: ctx.signal })
    },
  },
})

type Queries = ModelQueries<typeof userModel>
type FetchUser = Queries['fetchUser'] // QueryHandle<[string], User>
```

## Selectors

React selectors receive the flattened model API and the actions namespace:

```ts
import type { Selector } from 'react-doura'

const selector: Selector<typeof userModel> = (api, actions) => ({
  currentUser: api.currentUser,
  refresh: actions.refresh,
})
```

The same selector type is exported from `doura`.
