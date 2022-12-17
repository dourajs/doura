---
id: shuvi-runtime-app
title: "@shuvi/runtime/app"
---

## InitFunction

```ts
function init(): void | Promise<void>;
```

## AppContextFunction

```ts
function appContext(appContext: AppContext): void | Promise<void>;
```

- type [AppContext](./shuvi-runtime.md#appcontext)

## AppComponentFunction

```ts
function appComponent<T>(App: T, appContext: AppContext): Promise<T>;
```

- type [AppContext](./shuvi-runtime.md#appcontext)

## DisposeFunction

```ts
function dispose(): void | Promise<void>;
```
