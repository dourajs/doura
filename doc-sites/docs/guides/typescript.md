---
id: typescript
title: Typescript
---

You don't need to do much in order to make your state compatible with TS: make sure [`strict`](https://www.typescriptlang.org/tsconfig#strict), or at the very least, [`noImplicitThis`](https://www.typescriptlang.org/tsconfig#noImplicitThis), are enabled and Doura will infer the type of your state automatically! However, there are a few cases where you should give it a hand with some casting:

```ts
export const useUserStore = defineModel({
  state: {
    // for initially empty lists
    userList: [] as UserInfo[],
    // for data that is not yet loaded
    user: null as UserInfo | null,
  },
})

interface UserInfo {
  name: string
  age: number
}
```

If you prefer, you can define the state with an interface and type the `state`:

```ts
interface State {
  userList: UserInfo[]
  user: UserInfo | null
}

export const useUserStore = defineModel({
  state: {
    userList: [],
    user: null,
  } as State,
})

interface UserInfo {
  name: string
  age: number
}
```
