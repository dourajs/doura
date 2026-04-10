# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install              # Install dependencies
pnpm build                # Build all packages (rollup)
pnpm test                 # Run unit tests + type-check test-dts
pnpm test-unit            # Jest only
pnpm test-unit -- --testPathPattern="actions"  # Run a single test file by pattern
pnpm doc                  # Start Docusaurus dev server (doc-sites/)
pnpm doc:build            # Build docs
```

Build targets a specific package via `TARGET` env var (used internally by `scripts/build.js`). The build produces esm-bundler, esm-browser, cjs, and global (iife) formats depending on each package's `buildOptions.formats` in its `package.json`.

## Monorepo Structure

pnpm workspace with four packages. `react-doura`, `doura-plugin-log`, `doura-plugin-persist` all peer-depend on `doura`.

| Package | Path | Purpose |
|---|---|---|
| `doura` | `packages/doura` | Core: reactivity, model, store, scheduler, plugin system |
| `react-doura` | `packages/react-doura` | React bindings: hooks, container, batch manager |
| `doura-plugin-log` | `packages/doura-plugin-log` | Dev logging plugin |
| `doura-plugin-persist` | `packages/doura-plugin-persist` | State persistence with migration/versioning |

## Core Architecture

Doura is a model-based state manager that fuses **Immer's copy-on-write draft pattern** with **Vue 3's fine-grained dependency tracking**. The result: actions mutate state via mutable proxies, consumers read immutable snapshots with structural sharing.

### Draft / Snapshot Duality

The core abstraction in `packages/doura/src/reactivity/`:

1. **Draft** (`draft.ts`): `draft(target)` wraps an object in a Proxy. On first write, `prepareCopy()` shallow-copies `base` into `copy`, then `markChanged()` propagates `modified=true` up the parent chain. Nested object reads lazily create child drafts.

2. **Snapshot** (`draft.ts#snapshot`): Produces read-only proxies over finalized state. Unchanged sub-trees share references with previous snapshots (structural sharing).

3. **Effect tracking** (`effect.ts`): Directly modeled on Vue 3 — `track(target, type, key)` records deps in `targetMap: WeakMap<target, Map<key, Dep>>`, `trigger()` notifies dependents. Uses bitwise dep markers for efficient cleanup.

4. **View** (`view.ts`): Lazy-evaluated computed values (like Vue `computed()`). Dirty flag; re-evaluates only when deps trigger. Used for model `views`.

### Model System (`packages/doura/src/core/`)

- **`defineModel({state, actions?, views?})`** — type-narrowing identity function for TypeScript inference.
- **`ModelInternal`** (`model.ts`) — the runtime model instance:
  - State lives inside `draft({value: initState})`.
  - A `watch()` on the draft detects mutations and schedules `_update()` via `queueJob()`.
  - Two proxy layers for `this`:
    - **Internal proxy** (used as `this` in actions/views): reads live mutable draft via `InternalInstanceProxyHandlers`.
    - **Public proxy** (external API): reads immutable snapshot via `PublicInstanceProxyHandlers`.
  - When an action completes at depth 0, the scheduler job is invalidated and `_update()` fires synchronously — snapshot is immediately available after action call.
- **`use(name, model)`** (`use.ts`) — inside function models, composes child models. `currentModelContext` is set during function model evaluation; `use()` reads it, instantiates the child, and registers dependency propagation via `depend()`.
- **`ModelManager`** (`modelManager.ts`) — the store holding named model instances. `getModel(name, model)` retrieves or creates (cached by name). `getDetachedModel(model)` creates anonymous instances.
- **Scheduler** (`scheduler.ts`) — Vue 3-derived microtask scheduler with `queueJob()`, `invalidateJob()`, `nextTick()`.

### React Integration (`packages/react-doura/src/`)

- **`createContainer()`** (`createContainer.tsx`): Creates a React Context + Provider wrapping a `Doura` store instance. Returns `{ Provider, useSharedModel, useStaticModel }`.
- **`useModel(model, selector?)`** (`useModel.tsx`): Without a name, creates component-scoped anonymous model (own `doura()` in a `useRef`). With a name, delegates to global root store.
- **`createUseModel`** (`createUseModel.tsx`): Core hook logic using `useSyncExternalStore`. Without selector: subscribes to `$getApi()`. With selector: creates a `ModelView` via `$createView(selector)` for derived subscriptions.
- **`batchManager`** (`batchManager.ts`): Coordinates model change → React update batching via `unstable_batchedUpdates`.

### Plugin System

`Plugin<Option>` is `(option) => PluginHook`. Hooks: `onInit`, `onModel`, `onModelInstance`, `onDestroy`. Plugins are passed to `doura({ plugins: [[plugin, option]] })`.

## Build Details

- Rollup config in `rollup.config.mjs`, build script in `scripts/build.js`.
- `rollup-plugin-typescript2` for TS compilation; `@microsoft/api-extractor` for `.d.ts` rollup.
- Compile-time constants: `__DEV__`, `__TEST__`, `__VERSION__`, `__BROWSER__`, `__GLOBAL__`, `__ESM_BUNDLER__`, `__ESM_BROWSER__` (declared in `global.d.ts`, replaced via `@rollup/plugin-replace`).

## Known Constraints

- `picomatch` must stay pinned to `2.3.1` (`pnpm.overrides` in root `package.json`) — `2.3.2` has an extglob regression that breaks `rollup-plugin-typescript2` include patterns.
