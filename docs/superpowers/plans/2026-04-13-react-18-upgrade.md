# react-doura React 18+ Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `batchManager` and `use-sync-external-store` shim from `react-doura`, requiring React 18+ as the minimum peer dependency.

**Architecture:** Delete the `batchManager` abstraction entirely. Rewire `createUseModel` to subscribe directly via `model.$subscribe()`. Replace the `use-sync-external-store` shim with React 18's built-in `useSyncExternalStore`.

**Tech Stack:** React 18+, TypeScript, Jest, pnpm workspace

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Delete | `packages/react-doura/src/batchManager.ts` | Subscription batching (no longer needed) |
| Delete | `packages/react-doura/__tests__/batchManager.test.tsx` | Tests for deleted module |
| Edit | `packages/react-doura/src/createUseModel.tsx` | Core hook logic — remove batchManager param, direct subscribe, use React's useSyncExternalStore |
| Edit | `packages/react-doura/src/createContainer.tsx` | Context provider — remove batchManager from context |
| Edit | `packages/react-doura/src/useModel.tsx` | Anonymous model hook — remove batchManager creation |
| Edit | `packages/react-doura/package.json` | Drop shim dep, bump peer dep |
| Edit | `packages/react-doura/__tests__/createUseModel.test.tsx` | Remove batchManager from test setup |

---

### Task 1: Simplify `createUseModel.tsx` — remove batchManager and shim

This is the core change. All other files depend on the new signature of `createUseModel`.

**Files:**
- Modify: `packages/react-doura/src/createUseModel.tsx`

- [ ] **Step 1: Replace the `useSyncExternalStore` import**

Change line 11 from:
```ts
import { useSyncExternalStore } from 'use-sync-external-store/shim'
```
to:
```ts
import { useSyncExternalStore } from 'react'
```

Also update line 1 to include it (merge imports):
```ts
import { useDebugValue, useMemo, useRef, useSyncExternalStore } from 'react'
```
And delete the old `use-sync-external-store` import line entirely.

- [ ] **Step 2: Remove batchManager from `useModelInstance`**

Replace the entire `useModelInstance` function (lines 80-103) with:

```tsx
function useModelInstance<IModel extends AnyModel>(
  name: string,
  model: IModel,
  doura: Doura
) {
  const { modelInstance, subscribe } = useMemo(
    () => {
      const modelInstance = doura.getModel(name, model)
      return {
        modelInstance,
        subscribe: (onModelChange: () => void) =>
          modelInstance.$subscribe(() => onModelChange()),
      }
    },
    // ignore model's change
    [name, doura]
  )

  return {
    modelInstance,
    subscribe,
  }
}
```

Key changes:
- Removed `batchManager` parameter
- `subscribe` calls `modelInstance.$subscribe(() => onModelChange())` directly (wrapper needed because `SubscriptionCallback` expects `(event: ModelChangeEvent) => any`)

- [ ] **Step 3: Remove batchManager from `createUseModel`**

Replace the `createUseModel` export (lines 105-127) with:

```tsx
export const createUseModel =
  (doura: Doura) =>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    name: string,
    model: IModel,
    selector?: S,
    depends?: any[]
  ) => {
    const hasSelector = useRef(selector)
    const { modelInstance, subscribe } = useModelInstance(
      name,
      model,
      doura
    )

    // todo: warn when hasSelector changes
    if (hasSelector.current) {
      return useModelWithSelector(modelInstance, subscribe, selector!, depends)
    } else {
      return useModel(modelInstance, subscribe)
    }
  }
```

Key change: signature is now `(doura: Doura)` instead of `(doura: Doura, batchManager: ...)`.

- [ ] **Step 4: Remove the `createBatchManager` import**

Delete line 12:
```ts
import { createBatchManager } from './batchManager'
```

- [ ] **Step 5: Run tests to verify**

Run: `pnpm test-unit -- --testPathPattern="createUseModel"`

Expected: Tests will fail because `createUseModel.test.tsx` still passes batchManager. That's expected — we fix the tests in Task 5.

- [ ] **Step 6: Commit**

```bash
git add packages/react-doura/src/createUseModel.tsx
git commit -m "refactor(react-doura): remove batchManager from createUseModel

Direct model.$subscribe() replaces the batchManager indirection.
use-sync-external-store shim replaced with React 18 built-in."
```

---

### Task 2: Simplify `createContainer.tsx` — remove batchManager from context

**Files:**
- Modify: `packages/react-doura/src/createContainer.tsx`

- [ ] **Step 1: Remove `createBatchManager` import**

Delete line 11:
```ts
import { createBatchManager } from './batchManager'
```

- [ ] **Step 2: Simplify Context type and Provider**

Replace the `createContainer` function (lines 20-106) with:

```tsx
const createContainer = function (options?: DouraOptions) {
  const Context = createContext<{
    store: Doura
  }>(null as any)
  function Provider(props: PropsWithChildren<{ store?: Doura }>) {
    const { children, store: propsStore } = props

    const memoContext = useMemo(
      function () {
        let store: Doura
        if (propsStore) {
          store = propsStore
        } else {
          store = doura(options)
        }

        return {
          store,
        }
      },
      [propsStore]
    )

    const [contextValue, setContextValue] = useState(memoContext) // for hmr keep contextValue

    useEffect(
      function () {
        setContextValue(memoContext)
      },
      [propsStore]
    )

    return <Context.Provider value={contextValue}>{children}</Context.Provider>
  }

  const useDouraContext = () => {
    const context = useContext(Context)

    if (__DEV__ && !context) {
      throw new Error(
        `[react-doura]: could not find react-doura context value; please ensure the component is wrapped in a <Provider>.`
      )
    }
    return context
  }

  const useSharedModel: UseNamedModel = <
    IModel extends AnyModel,
    S extends Selector<IModel>
  >(
    name: string,
    model: IModel,
    selector?: S,
    depends?: any[]
  ) => {
    if (__DEV__) {
      checkName(name)
    }

    const { store } = useDouraContext()
    return useMemo(
      () => createUseModel(store),
      [store]
    )(name, model, selector, depends)
  }

  const useStaticModel: UseStaticModel = <IModel extends AnyModel>(
    name: string,
    model: IModel
  ) => {
    if (__DEV__) {
      checkName(name)
    }

    const { store } = useDouraContext()
    return useMemo(() => createUseStaticModel(store), [store])(name, model)
  }

  return {
    Provider,
    useSharedModel,
    useStaticModel,
  }
}
```

Key changes:
- Context type: `{ store: Doura }` (removed `batchManager`)
- Provider: no longer creates `batchManager`
- `useSharedModel`: `createUseModel(store)` instead of `createUseModel(store, batchManager)`

- [ ] **Step 3: Commit**

```bash
git add packages/react-doura/src/createContainer.tsx
git commit -m "refactor(react-doura): remove batchManager from createContainer"
```

---

### Task 3: Simplify `useModel.tsx` — remove batchManager creation

**Files:**
- Modify: `packages/react-doura/src/useModel.tsx`

- [ ] **Step 1: Remove batchManager import and simplify `useAnonymousModel`**

Replace the entire file with:

```tsx
import { useMemo, useRef } from 'react'
import { doura, AnyModel, Selector, Doura } from 'doura'
import { createUseModel } from './createUseModel'
import { UseAnonymousModel, UseModel, UseStaticModel } from './types'
import { DouraRoot, useRootModel, useRootStaticModel } from './global'

const ANONYMOUS_MODEL_NAME = 'anonymous model'

const useAnonymousModel: UseAnonymousModel = <
  IModel extends AnyModel,
  S extends Selector<IModel>
>(
  model: IModel,
  selector?: S,
  depends?: any[]
) => {
  // for hmr feature
  // useRef can keep context
  const context = useRef<{
    douraStore: Doura
  } | null>(null)

  if (!context.current) {
    context.current = {
      douraStore: doura(),
    }
  }

  return useMemo(
    function () {
      return createUseModel(
        context.current!.douraStore
      )
    },
    [context.current.douraStore]
  )(ANONYMOUS_MODEL_NAME, model, selector, depends)
}

const useModel = ((name: any, model: any, selector?: any, depends?: any) => {
  if (typeof name === 'string') {
    return useRootModel(name, model, selector, depends)
  }

  return useAnonymousModel(name, model, selector)
}) as UseModel

const useStaticModel: UseStaticModel = (name, model) => {
  return useRootStaticModel(name, model)
}

export { DouraRoot, useModel, useStaticModel }
```

Key changes:
- Removed `createBatchManager` import
- `useRef` context type: `{ douraStore: Doura }` (removed `batchManager`)
- `createUseModel(context.current!.douraStore)` — single argument
- `useMemo` deps: `[context.current.douraStore]` (removed `batchManager`)

- [ ] **Step 2: Commit**

```bash
git add packages/react-doura/src/useModel.tsx
git commit -m "refactor(react-doura): remove batchManager from useModel"
```

---

### Task 4: Delete batchManager files

**Files:**
- Delete: `packages/react-doura/src/batchManager.ts`
- Delete: `packages/react-doura/__tests__/batchManager.test.tsx`

- [ ] **Step 1: Delete the source file and test file**

```bash
git rm packages/react-doura/src/batchManager.ts
git rm packages/react-doura/__tests__/batchManager.test.tsx
```

- [ ] **Step 2: Verify no remaining references**

```bash
grep -r "batchManager\|createBatchManager" packages/react-doura/src/
```

Expected: no output (zero matches).

- [ ] **Step 3: Commit**

```bash
git add -A packages/react-doura/src/batchManager.ts packages/react-doura/__tests__/batchManager.test.tsx
git commit -m "refactor(react-doura): delete batchManager module and tests"
```

---

### Task 5: Update tests — remove batchManager from `createUseModel.test.tsx`

**Files:**
- Modify: `packages/react-doura/__tests__/createUseModel.test.tsx`

- [ ] **Step 1: Remove batchManager from imports and setup**

Replace lines 1-48 with:

```tsx
import React, { useMemo } from 'react'
import { render, act } from '@testing-library/react'
import {
  defineModel,
  doura,
  AnyModel,
  Selector,
  ModelAPI,
  ModelActions,
  nextTick,
  use,
} from 'doura'
import { UseNamedModel, UseStaticModel } from '../src/types'
import { createUseModel, createUseStaticModel } from '../src/createUseModel'
import { countModel } from './models/index'

let douraStore: ReturnType<typeof doura>
let useTestModel: UseNamedModel
let useTestStaticModel: UseStaticModel

beforeEach(() => {
  process.env.NODE_ENV === 'development'
  jest.useFakeTimers()
  douraStore = doura()
  useTestModel = <IModel extends AnyModel, S extends Selector<IModel>>(
    name: string,
    model: IModel,
    selector?: S,
    depends?: any[]
  ) => {
    return useMemo(
      () => createUseModel(douraStore),
      [douraStore]
    )(name, model, selector, depends)
  }
  useTestStaticModel = <IModel extends AnyModel>(
    name: string,
    model: IModel
  ) => {
    return useMemo(
      () => createUseStaticModel(douraStore),
      [douraStore]
    )(name, model)
  }
})
```

Key changes:
- Removed `import { createBatchManager } from '../src/batchManager'`
- Removed `let batchManager` declaration
- Removed `batchManager = createBatchManager()` from `beforeEach`
- `createUseModel(douraStore)` — single argument (removed `, batchManager`)
- `useMemo` deps: `[douraStore]` (removed `, batchManager`)

- [ ] **Step 2: Run all react-doura tests**

Run: `pnpm test-unit -- --testPathPattern="react-doura"`

Expected: All tests pass. The `batchManager.test.tsx` file is already deleted so its tests won't run.

- [ ] **Step 3: Commit**

```bash
git add packages/react-doura/__tests__/createUseModel.test.tsx
git commit -m "test(react-doura): remove batchManager from test setup"
```

---

### Task 6: Update `package.json` — drop shim, bump peer deps

**Files:**
- Modify: `packages/react-doura/package.json`

- [ ] **Step 1: Remove `use-sync-external-store` from dependencies**

In the `"dependencies"` block, delete:
```json
"use-sync-external-store": "1.2.0"
```

Remove the entire `"dependencies"` block if it becomes empty.

- [ ] **Step 2: Remove `@types/use-sync-external-store` from devDependencies**

In the `"devDependencies"` block, delete:
```json
"@types/use-sync-external-store": "0.0.3",
```

- [ ] **Step 3: Bump peer dependency versions**

Change:
```json
"react": ">=16.8",
"react-dom": ">=16.8"
```
to:
```json
"react": ">=18",
"react-dom": ">=18"
```

- [ ] **Step 4: Run `pnpm install` to update lockfile**

```bash
pnpm install
```

Expected: Lockfile updated, `use-sync-external-store` removed from `node_modules` for this package.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass, type-check passes.

- [ ] **Step 6: Run build**

```bash
pnpm build
```

Expected: Build succeeds. Verify no `use-sync-external-store` or `unstable_batchedUpdates` in output:

```bash
grep -r "use-sync-external-store\|unstable_batchedUpdates" packages/react-doura/dist/
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add packages/react-doura/package.json pnpm-lock.yaml
git commit -m "chore(react-doura): drop use-sync-external-store, require React >=18"
```
