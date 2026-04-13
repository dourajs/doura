# react-doura: Upgrade to React 18+ and Remove unstable_batchedUpdates

## Goal

Drop React < 18 support from `react-doura`. Remove the `batchManager` abstraction and `use-sync-external-store` shim, both made redundant by React 18's automatic batching and built-in `useSyncExternalStore`.

## Background

`batchManager.ts` serves two purposes:

1. **Batched updates** — wraps component re-render callbacks in `unstable_batchedUpdates` so multiple `setState` calls from a single model change produce one React re-render.
2. **Subscription deduplication** — maintains a `WeakMap<model, Set<callback>>` so only one `model.$subscribe()` call is made per model regardless of how many components subscribe.

React 18 makes both unnecessary:
- Automatic batching covers all contexts (events, timeouts, promises), replacing `unstable_batchedUpdates`.
- `model.subscribe()` is a simple `Set.add`/`Set.delete` — deduplication adds no meaningful performance benefit.

React 18 also ships `useSyncExternalStore` natively, so the `use-sync-external-store` shim polyfill is no longer needed.

## Changes

### 1. Delete `batchManager.ts`

Remove `packages/react-doura/src/batchManager.ts` entirely.

### 2. Simplify `createUseModel.tsx`

- Remove `batchManager` parameter from `useModelInstance` and `createUseModel`.
- Change `subscribe` to call `model.$subscribe` directly. A wrapper arrow function is needed because `SubscriptionCallback` expects `(event: ModelChangeEvent) => any` while `useSyncExternalStore` passes `() => void`:
  ```ts
  subscribe: (onModelChange: () => void) =>
    modelInstance.$subscribe(() => onModelChange())
  ```
- Replace `import { useSyncExternalStore } from 'use-sync-external-store/shim'` with `import { useSyncExternalStore } from 'react'`.

### 3. Simplify `createContainer.tsx`

- Remove `createBatchManager` import.
- Change Context type from `{ store: Doura, batchManager: ... }` to `{ store: Doura }`.
- Remove batchManager creation in Provider.
- Update `useSharedModel` to pass only `store` to `createUseModel`.

### 4. Simplify `useModel.tsx`

- Remove `createBatchManager` import.
- In `useAnonymousModel`, remove batchManager from the `useRef` context and `createUseModel` call.

### 5. Update `package.json`

- Remove `use-sync-external-store` from `dependencies`.
- Remove `@types/use-sync-external-store` from `devDependencies`.
- Change `peerDependencies.react` from `>=16.8` to `>=18`.
- Change `peerDependencies.react-dom` from `>=16.8` to `>=18`.

### 6. Update tests

- Delete `__tests__/batchManager.test.tsx`.
- In `__tests__/createUseModel.test.tsx`: remove batchManager import, initialization, and parameter passing.

## Files Affected

| Action | File |
|--------|------|
| Delete | `packages/react-doura/src/batchManager.ts` |
| Delete | `packages/react-doura/__tests__/batchManager.test.tsx` |
| Edit   | `packages/react-doura/src/createUseModel.tsx` |
| Edit   | `packages/react-doura/src/createContainer.tsx` |
| Edit   | `packages/react-doura/src/useModel.tsx` |
| Edit   | `packages/react-doura/package.json` |
| Edit   | `packages/react-doura/__tests__/createUseModel.test.tsx` |

## Verification

1. `pnpm test-unit` — all existing tests pass (minus deleted batchManager tests).
2. `pnpm build` — build succeeds with no `use-sync-external-store` or `react-dom` imports in output (for batching).
3. The batching test case in `batchManager.test.tsx` ("render should be batched when update occurs out of react's lifecycle") is covered by React 18's automatic batching — no replacement test needed.
