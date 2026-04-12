# Reactivity for React: Technical Reference

> **Purpose**: Agent context document. Provides a comprehensive technical description of Vue 3's reactivity system, Mutative's draft system, and Doura's fusion of both — sufficient for an AI agent to reason about Doura's design decisions and optimization opportunities.

---

## 1. Vue 3 Reactivity System

Vue 3's reactivity is a Proxy-based fine-grained dependency tracking system. It automatically records which reactive properties an effect reads, and re-runs that effect when those properties change.

### 1.1 Core Data Structures

```
targetMap: WeakMap<object, Map<key, Dep>>
```

The central dependency registry. Maps a reactive target object to a per-key map of `Dep` sets.

**`Dep`** = `Set<ReactiveEffect>` extended with two bitwise markers:
- `w` (wasTracked) — bit mask of which recursion levels previously tracked this dep
- `n` (newTracked) — bit mask of which recursion levels freshly tracked this dep in the current run

**`ReactiveEffect`**:
- `fn: () => T` — the effect function to execute
- `scheduler?: EffectScheduler` — optional custom scheduler (used by computed to set dirty flag instead of re-running immediately)
- `deps: Dep[]` — all Dep sets this effect is registered in (for cleanup)
- `parent: ReactiveEffect | undefined` — link for nested effect tracking
- `computed?: ComputedRefImpl` — back-reference when this effect backs a computed value
- `active: boolean` — false after `stop()` is called

### 1.2 Dependency Tracking (track/trigger)

**track(target, type, key)**:
1. Only runs when `shouldTrack && activeEffect` are truthy
2. Gets or creates `targetMap[target][key]` → a `Dep` set
3. Calls `trackEffects(dep)`:
   - Within recursion depth ≤ 30: uses bitwise markers. Sets `dep.n |= trackOpBit`. Only adds the effect if `!wasTracked(dep)` (the dep was not already tracked in a prior run at this recursion level)
   - Beyond 30 levels: falls back to full `!dep.has(activeEffect)` check

**trigger(target, type, key, newValue?, oldValue?)**:
1. Gets `depsMap = targetMap[target]`. If none, returns (never tracked)
2. Collects relevant `Dep` sets based on operation type:
   - `CLEAR` → all deps for the target
   - Array `length` change → all deps with numeric keys ≥ new length, plus the `length` dep
   - `SET | ADD | DELETE` → dep for the specific key, plus `ITERATE_KEY` for non-array targets, plus `MAP_KEY_ITERATE_KEY` for Maps, plus `length` for array ADD
3. Calls `triggerEffects(dep)`:
   - **Computed effects run first** (effects with `.computed` set), then non-computed effects
   - Each effect: if it has a `scheduler`, calls `scheduler()`. Otherwise calls `effect.run()`
   - Guards against triggering the currently running effect (prevents infinite loops)

### 1.3 ReactiveEffect.run()

```
run():
  1. Save activeEffect and shouldTrack on stack
  2. Set activeEffect = this, shouldTrack = true
  3. trackOpBit = 1 << ++effectTrackDepth
  4. If depth ≤ 30: initDepMarkers(this) — marks all existing deps with "wasTracked" bit
     If depth > 30: cleanupEffect(this) — removes this from all deps entirely
  5. Execute this.fn()   ← property reads inside fn() call track()
  6. If depth ≤ 30: finalizeDepMarkers(this) — removes deps that were tracked before but not during this run
  7. Restore activeEffect, shouldTrack, trackOpBit
```

### 1.4 Bitwise Dep Markers (Optimization)

The naive approach: before each effect run, remove the effect from all its deps, then re-add during execution. This is O(deps) every run.

Vue 3's optimization: use one bit per recursion depth level. Before the run, mark all existing deps as "was tracked" (`dep.w |= bit`). During the run, mark encountered deps as "newly tracked" (`dep.n |= bit`). After the run, `finalizeDepMarkers` removes deps where `wasTracked && !newTracked` — these are stale. Deps where `wasTracked && newTracked` are kept without any set mutation.

This avoids Set add/delete operations for stable dependency graphs (the common case).

Limited to 30 recursion levels (fits in a SMI on all JS engines). Beyond 30, falls back to full cleanup.

### 1.5 Proxy Handlers (baseHandlers)

**`createGetter(isReadonly, shallow)`**:
- Returns the raw target for `ReactiveFlags.RAW` access
- For arrays: instruments `includes`, `indexOf`, `lastIndexOf` (identity-sensitive methods) and `push`, `pop`, `shift`, `unshift`, `splice` (length-mutating methods pause tracking to avoid infinite loops)
- Calls `track(target, GET, key)` (unless readonly)
- Lazy deep reactivity: if the returned value `isObject`, wraps it with `reactive()` (or `readonly()`) on access — **not** upfront

**`createSetter(shallow)`**:
- Unwraps values from reactive wrappers before comparing (`toRaw`)
- Detects ADD vs SET (key didn't exist before vs already existed)
- Calls `trigger(target, ADD|SET, key, value, oldValue)` only when value actually changed (`hasChanged`)
- Guards: only triggers if `target === toRaw(receiver)` (avoids triggering for prototype chain inherited writes)

**`deleteProperty`**: triggers `DELETE` if key existed.

**`has`**: tracks `HAS` operation.

**`ownKeys`**: tracks `ITERATE` on the `ITERATE_KEY` symbol (or `length` for arrays).

### 1.6 Computed (ComputedRefImpl)

```ts
class ComputedRefImpl<T> {
  _dirty = true
  _value: T
  effect: ReactiveEffect<T>
}
```

- Constructor: creates a `ReactiveEffect(getter, scheduler)`. The scheduler sets `_dirty = true` and calls `triggerRefValue(this)` — it does NOT re-execute the getter.
- `get value()`: if `_dirty`, runs `effect.run()` to recompute, caches result in `_value`, sets `_dirty = false`. Calls `trackRefValue(self)` to allow parent effects to depend on this computed.
- Lazy evaluation: the getter only runs when someone reads `.value` AND it's dirty.

### 1.7 reactive() / createReactiveObject()

- Checks for existing proxy in `reactiveMap: WeakMap<Target, Proxy>` (deduplication)
- Determines target type: COMMON (Object/Array) → `baseHandlers`, COLLECTION (Map/Set/WeakMap/WeakSet) → `collectionHandlers`, INVALID → return as-is
- Creates `new Proxy(target, handlers)`, stores in `reactiveMap`
- `ReactiveFlags` are virtual properties intercepted in the GET trap (IS_REACTIVE, IS_READONLY, IS_SHALLOW, RAW)

### 1.8 Summary of Vue Reactivity Characteristics

| Characteristic | Description |
|---|---|
| Granularity | Per-property (each key tracked independently) |
| Trigger | Synchronous notification, scheduler determines when effects actually re-run |
| State model | Mutable — reactive objects are mutated in place |
| Lazy | Proxies created lazily on access (deep reactive), computed re-evaluated lazily on read |
| Memory | WeakMap-based, GC-friendly |
| Optimization | Bitwise dep markers avoid set operations for stable dependency graphs |

---

## 2. Mutative Draft System

Mutative is a copy-on-write immutable state library, functionally equivalent to Immer but with performance optimizations. The API: `create(baseState, mutate) → nextState`.

### 2.1 Core Data Structures

**`ProxyDraft<T>`**:
```ts
interface ProxyDraft<T> {
  type: DraftType          // Object | Array | Map | Set
  operated?: boolean       // has any mutation happened
  finalized: boolean       // true after finalization pass
  original: T              // the original immutable state
  copy: T | null           // lazy shallow copy (created on first write)
  proxy: T | null          // the Proxy object itself
  parent?: ProxyDraft      // parent in the draft tree
  key?: PropertyKey        // key in parent
  finalities: Finalities   // shared finalization callbacks + revoke list
  options: Options          // strict, enablePatches, enableAutoFreeze, mark
  assignedMap?: Map<any, boolean>  // tracks user-assigned keys (true) / deleted keys (false)
  setMap?: Map<any, ProxyDraft>    // for Set drafts: maps values to draft proxies
}
```

**`Finalities`**:
```ts
interface Finalities {
  draft: ((patches?, inversePatches?) => void)[]  // finalization callbacks (one per child draft)
  revoke: (() => void)[]                           // Proxy.revocable revoke functions
  handledSet: WeakSet<any>                         // dedup for finalization
  draftsCache: WeakSet<object>                     // fast isDraft check for assigned values
}
```

### 2.2 Draft Creation (createDraft)

1. Creates a `ProxyDraft` object with `copy: null`, `original: baseState`
2. For Arrays: proxy target is `Object.assign([], proxyDraft)` (so `Array.isArray()` works)
3. Uses `Proxy.revocable()` — all proxies can be revoked after finalization (prevents use-after-finish)
4. Registers a finalization callback in `parent.finalities.draft`:
   - On finalization, walks the draft tree bottom-up
   - For each child: if `operated`, takes the `copy` as the new value; otherwise uses `original`
   - Replaces the draft proxy reference in the parent's copy with the resolved value

### 2.3 Proxy Handler (proxyHandler)

**GET trap**:
1. Returns `target` itself for `PROXY_DRAFT` symbol (unwrap mechanism)
2. Supports `mark()` system: allows users to mark values as `mutable` (returned as-is), or provide custom shallow copy functions
3. Reads from `latest(target)` = `target.copy ?? target.original`
4. For Map/Set: returns instrumented methods from `mapHandler`/`setHandler`
5. **Lazy child drafting**: if `value === peek(target.original, key)` (the value hasn't been overwritten), creates a new child draft via `createDraft()` and stores it in `target.copy[key]`
6. Caches drafted children in `finalities.draftsCache` for fast re-access

**SET trap**:
1. Validates: only array indices and `length` for arrays
2. If the current value is a draft and the new value equals the draft's original → records `assignedMap.set(key, false)` (assignment reverts to original)
3. If value unchanged and key exists → no-op
4. `ensureShallowCopy(target)` — creates shallow copy of `original` if `copy` is null
5. `markChanged(target)` — sets `operated = true` and propagates up the parent chain
6. Updates `assignedMap` — tracks whether the key was user-assigned (true) or reverted to original (delete from map)
7. Calls `markFinalization` — registers patch generation callback

**DELETE trap**:
- `ensureShallowCopy` + `markChanged`, updates `assignedMap.set(key, false)`, deletes from `copy`

### 2.4 Finalization (finalizeDraft)

```
finalizeDraft(draft, returnedValue, patches?, inversePatches?, enableAutoFreeze?):
  1. If draft.operated (mutations happened):
     - Pop and execute all finalization callbacks in reverse (bottom-up)
     - Each callback: resolves child draft → replaces proxy ref in parent's copy
  2. Final state = returnedValue[0] if user returned a value, else draft.copy (if operated) or draft.original
  3. Revoke all proxies (prevents use-after-finish)
  4. Optional: deepFreeze the result
  5. Return [state, patches, inversePatches]
```

### 2.5 Structural Sharing

Structural sharing is implicit in the copy-on-write design:
- Unmodified sub-trees: the parent's `copy` still holds the same `original` reference (no child draft was ever created, or the child draft was not operated)
- Modified sub-trees: the child draft's `copy` replaces the proxy in the parent's `copy`
- Result: `nextState.unchanged === baseState.unchanged` → true (same reference)

### 2.6 Key Differences from Immer

| Aspect | Immer | Mutative |
|---|---|---|
| Proxy creation | Each access creates a child proxy | Same, but with `draftsCache` optimization for re-access |
| Revocable proxies | Yes | Yes (via `Proxy.revocable`) |
| Finalization | Recursive walk | Callback-based (each child registers its own finalizer) |
| Shallow copy | `Object.getOwnPropertyDescriptors` | `Object.keys` based (faster, ~3x for large objects) — non-enumerable/symbol keys only via `mark()` + `strictCopy` |
| Type discrimination | `Object.prototype.toString.call()` | `instanceof` checks (faster, ~10x) |
| Patches | Built-in | Optional via `enablePatches` |
| Mark system | N/A | `mark(value, dataTypes)` — allows mutable passthrough, custom copy functions, immutable class handling |

---

## 3. Doura: The Fusion

Doura merges Vue 3's dependency tracking with Mutative's copy-on-write drafts into a single Proxy-based system. The key insight: **a single Proxy handler simultaneously serves two purposes** — tracking read dependencies for fine-grained reactivity AND performing copy-on-write for immutable snapshots.

### 3.1 Adapted Reactivity Layer (`packages/doura/src/reactivity/`)

Doura ports Vue 3's `effect.ts`, `dep.ts`, and `effectScope.ts` with the following adaptations:

**Same as Vue 3:**
- `targetMap: WeakMap<any, Map<key, Dep>>` structure
- `ReactiveEffect` class with `fn`, `scheduler`, `deps`, `parent`
- `track(target, type, key)` and `trigger(target, type, key, ...)` — identical algorithm
- Bitwise dep markers (30-level limit)
- `triggerEffects` ordering: computed/view effects first, then non-view effects
- `pauseTracking()` / `resetTracking()` for array mutation methods

**Additions for draft integration:**

1. **`referenceMap: WeakMap<any, Dep>`** — maps a DraftState to a Dep that tracks "whole-draft identity". Used by `trackDraft()`.

2. **`trackDraft(target)`**: When an effect reads a draft proxy, `trackDraft` records that the effect depends on the draft proxy as a whole (not a specific key). This is used by views to detect "the sub-tree under this draft might have changed".

3. **`triggerDraft(state)`**: When a draft state is mutated (in the SET trap), walks up the parent chain calling `triggerDraftChange(state)` at each level. For each level, checks `referenceMap` for effects that tracked that level's draft. For those effects (view effects), sets `view.mightChange = true`.

4. **Listener mechanism in `trigger()`**: At the end of trigger, if `state.root.listeners` exists, calls each listener. This is how `watch(draft, callback)` works — the watch callback is called on any mutation to the draft tree.

### 3.2 DraftState and Proxy Handlers

**`DraftState`** (in `draft.ts`):
```ts
interface DraftState {
  id: number
  root: DraftState              // root of the draft tree
  parent?: DraftState           // parent state
  key: any                      // creation-time key in parent
  base: any                     // current base value (after steal: resolved plain values)
  proxy: any                    // the Proxy object
  copy: any | null              // lazy shallow copy for current action (only created by SET/DELETE)
  modified: boolean             // has been mutated (bubbles up via markChanged)
  disposed: boolean             // after dispose
  assignedMap: Map<any, boolean> | null  // user SET/DELETE tracking
  hasDraftableAssignment?: boolean  // flag on root: a non-draft draftable was assigned
  listeners: Array<() => void> | null  // watch() callbacks
  version: number               // root only: incremented on every mutation in trigger()
  children: DraftState[] | null   // child draft states (for BFS in snapshot)
  childDrafts: Map<any, Drafted> | null  // child draft proxies from GET (separate from copy)
  // Set-specific:
  type: DraftType.Object | DraftType.Map | DraftType.Set
  drafts?: Map<any, Drafted>    // Set only: original → draft mapping
}
```

Key differences from Mutative's `ProxyDraft`:
- **No `finalities`** — Doura does not use callback-based finalization. Instead, it uses BFS over `children` + `assignedMap` in the `snapshot()` function.
- **`children` array** — explicitly tracks parent→child relationships for BFS traversal during snapshot.
- **`childDrafts` map** — stores child draft proxies created by read-only GET access, separate from `copy`. This avoids triggering `prepareCopy` (shallowCopy) for read-only property traversals. The GET trap checks `childDrafts` first for existing child drafts before creating new ones.
- **`listeners`** — supports `watch(draft, callback)` for change notification.
- **`root` reference** — every state knows its root, used for `hasDraftableAssignment` flag.
- **`modified` flag** — boolean, bubbles up via `markChanged()`. Mutative uses `operated` only on the node itself (not bubbled).

**Proxy handler GET trap (baseHandlers.ts)**:

The GET trap is the fusion point:
```
GET(state, prop):
  1. Handle ReactiveFlags (STATE, IS_REACTIVE, SKIP)
  2. Read value = latest(state)[prop]       ← latest = state.copy ?? state.base
  3. track(state, GET, prop)                ← Vue-style dep tracking
  4. If value is a non-draft object:
     - Check state.childDrafts.get(prop)    ← reuse existing child draft (no copy!)
     - If no existing child draft:
       - draft(value, state, prop)          ← create new child draft proxy
       - state.childDrafts.set(prop, child) ← store in separate map, NOT in copy
     - trackDraft(childDraft)               ← track whole-draft identity for views
  5. Return value (draft proxy for objects, raw for primitives)
```

**Key optimization**: The GET trap does **NOT** call `prepareCopy`. Child drafts are stored in the separate `childDrafts` Map, avoiding a shallowCopy of the parent for read-only access. A traversal like `this.a.b.c.d` produces 0 shallowCopy operations.

**Proxy handler SET trap**:
```
SET(state, prop, value):
  1. If value unchanged (Object.is): no-op
  2. If value is the childDraft for this key (d.x = d.x): no-op
  3. prepareCopy(state)                     ← lazy shallow copy on first write
     - Also transfers childDrafts entries into copy for consistency
  4. markChanged(state) if not already      ← set modified=true, bubble up to parent
  5. state.copy[prop] = value
  6. Invalidate childDrafts entry for overwritten key
  7. Manage children refs (removeChildRef old, addChildRef new if draft)
  8. Update assignedMap
  9. trigger(state, SET/ADD, prop, value)   ← Vue-style reactivity notification
  10. triggerDraft(state)                   ← walk up parent chain, set mightChange on views
```

**Note**: `prepareCopy` is only called in SET/DELETE traps (actual mutations). When called, it transfers any existing entries from `childDrafts` into the newly created copy so that subsequent reads via `latest(state)` = `state.copy` find the child draft proxies.

### 3.3 Snapshot System

The snapshot system converts the mutable draft tree into immutable plain values after an action completes.

**`snapshot(value, draft, cache?)`**:
```
1. If root is not modified → resolveValue(value, emptyMap, cache) and return
2. BFS: collect all modified states starting from root, traversing children arrays
3. Leaf-first stealAndReset:
   - For each modified state (bottom-up):
     - Steal: state.base = state.copy ?? shallowCopy(state.base)
     - childDrafts are NOT merged into stolen value
     - Reset: state.copy = null, state.modified = false
4. Clear cache entries for modified states
5. resolveStates(modifiedStates, hasDraftableAssignment, cache):
   - For each modified state (leaf-first), resolve IN-PLACE in state.base:
     a. Resolve childDrafts: for each entry in state.childDrafts,
        replace state.base[key] with child's resolved base or cache
     b. Resolve children: for each child in state.children,
        if state.base[child.key] === child.proxy → replace with resolved value
     c. Resolve assignedMap: for each assigned=true key,
        if value is a draft proxy → resolve to resolved/copy/base
        if value is plain draftable and hasDraftableAssignment → resolveValue recursively
     d. Resolve Set drafts: replace draft proxies with base values
     e. Store: resolved.set(state, state.base), cache.set(state.proxy, state.base)
6. resolveValue(value, resolved, cache):
   - Copy-on-write resolution of the requested value
   - Draft proxies → look up in resolved map, then cache, then state.copy (orphan fallback), then state.base
   - Plain objects → recurse into properties, clone only if a property needed resolution
   - Returns original reference if no resolution needed (zero allocation)
7. Return resolved value
```

**Key optimization: no second shallowCopy.** The old `buildClones` step created a separate clone per modified state to avoid modifying the stolen copy (which needed to retain draft proxy refs for DraftState identity). With `childDrafts`, DraftState identity is preserved via the `childDrafts` Map — the GET trap checks it first. So `state.base` no longer needs draft proxy refs, and `resolveStates` resolves in-place.

**DraftState identity preservation via childDrafts:**

After `stealAndReset` + `resolveStates`, `state.base` contains plain resolved values (no draft proxies). On the next action's GET trap:
1. `latest(state)` = `state.base` (copy is null) → reads a plain object at `state.base[prop]`
2. `!value[ReactiveFlags.STATE]` → true (it's a plain object)
3. `state.childDrafts.get(prop)` → finds the existing child draft proxy → returns it
4. DraftState identity preserved → `targetMap` entries preserved → dependency chains intact

**Orphan draft handling:**

Orphan drafts (not found by BFS — e.g., draft proxies nested in new plain objects, or cross-root foreign drafts) are NOT collected by BFS and NOT processed by `resolveStates`. They are handled lazily by `resolveValue`'s fallback chain:

```ts
const resolved = clones.get(state) || state.copy || state.base
```

- `clones.get(state)` → undefined (orphan not in resolved map)
- `state.copy` → the orphan's modified copy (stealAndReset was never called on it)
- `state.base` → original value (fallback for unmodified orphans)

This lazy approach avoids the cost of eagerly scanning plain objects for nested draft proxies during BFS. After snapshot, orphan drafts are unreachable from the state tree (their proxy refs were resolved to plain values) and are garbage collected.

**Structural sharing via cache:**

The `cache` parameter (`_lastDraftToSnapshot` in the model) maps `draftProxy → resolvedPlainValue`:
- Modified states: old cache entry deleted, new resolved value stored
- Unmodified states: cache returns previous resolved value (same reference)
- This enables `snapshot1.settings === snapshot2.settings` when settings was not modified between actions → React skips re-render

### 3.4 View (Computed) System

**`ViewImpl`** (in `reactivity/view.ts`):
```ts
class ViewImpl {
  _value: any
  dirty: boolean         // true when deps changed
  mightChange: boolean   // true when a tracked draft sub-tree changed
  effect: ReactiveEffect

  constructor(getter) {
    this.effect = new ReactiveEffect(getter, scheduler)
    // scheduler: sets dirty = true, calls triggerView(this)
  }

  get value() {
    if (dirty) {
      _value = effect.run()  // re-evaluate getter
      dirty = false
    }
    trackView(self)   // let parent effects track this view
    return _value
  }
}
```

**`mightChange` optimization:**

When a draft state is mutated, `triggerDraft` walks up the parent chain and sets `mightChange = true` on any views that called `trackDraft()` on that level. This is a coarse signal: "something in the sub-tree you read has changed."

The model's `getSnapshot()` for views checks `mightChange`:
- If `mightChange === false` → return cached snapshot (the view's dependencies were not affected)
- If `mightChange === true` → regenerate snapshot via `snapshot(view.value, draft, cache)`
- Reset `mightChange = false` after check

This avoids unnecessary `snapshot()` calls for views whose tracked draft sub-tree was not modified.

### 3.5 How the Two Systems Interact

```
Action execution:
  ┌─ Reads go to draft proxy ───┐
  │  GET trap:                   │
  │    track(state, GET, key)    │── Vue path: record per-key dependency
  │    childDrafts.get(key)      │── check existing child draft (no copy!)
  │    OR draft(value) + store   │── Mutative path: create child draft, store in childDrafts
  │    trackDraft(child)         │── Vue path: record whole-draft dependency for views
  └──────────────────────────────┘

  ┌─ Writes go to draft proxy ──┐
  │  SET trap:                   │
  │    prepareCopy (COW)         │── Mutative path: shallowCopy + transfer childDrafts
  │    markChanged (bubble up)   │
  │                              │
  │    trigger(state, SET, key)  │── Vue path: notify effects of per-key change
  │    triggerDraft(state)       │── Vue path: notify views of sub-tree change
  └──────────────────────────────┘

After action (depth=0):
  snapshot():
    1. Steal copies from draft tree (COW finalize: 1 shallowCopy per modified node)
    2. Resolve draft refs in-place in stolen copies (no second shallowCopy)
    3. resolveValue with cache (cross-snapshot structural sharing)
    → Immutable snapshot ready for React consumption

React consumption:
  useSyncExternalStore(subscribe, getSnapshot):
    getSnapshot reads view.value → triggers effect → tracks deps (Vue path)
    Returns snapshot value (structurally shared plain value)
    Reference equality check → bailout if unchanged
```

---

## 4. Model System (`packages/doura/src/core/`)

### 4.1 defineModel

```ts
defineModel({ state, actions?, views? })
```

Type-narrowing identity function. Returns the same object with TypeScript inference for action `this` binding, view `this` binding, and state shape.

### 4.2 ModelInternal

The runtime model instance. Central orchestrator.

**Construction:**
1. `this.stateRef = draft({ value: initState })` — wraps initial state in a mutable draft. The `{ value: ... }` wrapper allows the entire state to be replaced atomically.
2. `watch(stateRef, () => queueJob(this._update))` — listens for any draft mutation, schedules async update.
3. Creates two Proxy-based `this` contexts:
   - **Internal proxy** (`InternalInstanceProxyHandlers`): `this` in actions/views. State reads go through live draft (`instance.stateValue`). Writes go to draft.
   - **Public proxy** (`PublicInstanceProxyHandlers`): external API. State reads go through `instance.getState()` (latest snapshot).
4. Creates `EffectScope` for reactive effect lifecycle management.
5. Initializes actions (bound to internal proxy) and views (reactive computed values).

**Property access caching (`accessCache`):**

First access to a property determines its category (STATE, VIEW, ACTION, CONTEXT). Subsequent accesses use the cache, skipping the lookup chain.

**`$`-prefixed public properties:** `$state`, `$actions`, `$views`, `$patch`, `$subscribe`, `$onAction`, `$isolate`, `$getApi`, `$createView` — mapped via `publicPropertiesMap`.

### 4.3 Action Execution

```
action call → model.actions[name].apply(this.proxy, args):
  1. ++_actionDepth
  2. Execute action function with internal proxy as `this`
     - this.xxx reads from live draft (GET trap → track)
     - this.xxx = value writes to draft (SET trap → trigger)
  3. --_actionDepth
  4. If depth returns to 0:
     a. invalidateJob(this._update)  — cancel any pending async update
     b. this._update()               — synchronous flush:
        - Check isModified(stateRef)
        - dispatch(MODIFY) → calls reducer
        - reducer calls snapshot(stateRef.value, stateRef.value, _lastDraftToSnapshot)
        - Store snapshot as immutableState
        - Notify subscribers
```

**Key design choice**: At action depth 0, update is synchronous. The scheduler job (queued by `watch()` listener) is invalidated and replaced by an immediate call. This ensures that after an action returns, the snapshot is immediately available.

### 4.4 View (Model-Level)

```ts
createView(viewFn):
  1. Sets accessContext = VIEW (prevents action calls inside views)
  2. Creates a ViewImpl (reactive computed) wrapping the view function
  3. The view function receives internal proxy as `this` and first argument
  4. Returns a view object with getSnapshot():
     - Reads view.value (lazy evaluation, tracks deps)
     - If view.mightChange → regenerate snapshot
     - If raw value changed → regenerate snapshot
     - Otherwise return cached snapshot (structural sharing)
```

### 4.5 Model Composition (use.ts)

```ts
use(name, model):
  1. Requires active currentModelContext (set during function model creation)
  2. manager.getModelInstance({ name, model }) — get or create child model
  3. parentModel.addChild(instance) — register dependency
```

When the parent model is fully created, `model.depend(child)` subscribes to child changes and re-broadcasts through the parent.

### 4.6 ModelManager

The store holding named model instances.

- `getModel(name, model)` — retrieves or creates (cached by name)
- `getDetachedModel(model)` — creates anonymous instance
- Supports function models: sets `currentModelContext`, executes factory, wires up `use()` dependencies
- Plugin hooks: `onInit`, `onModel`, `onModelInstance`, `onDestroy`
- Global change subscription: `subscribe()` fires via `queueJob` when any named model changes

### 4.7 Scheduler

Direct port of Vue 3's microtask scheduler:
- `queueJob(job)` — adds to queue (deduped by job identity), schedules `flushJobs` via `Promise.resolve().then()`
- `invalidateJob(job)` — removes from queue
- Jobs sorted by `id` before execution
- Pre-flush and post-flush callback queues
- Recursion limit of 100

In Doura:
- Batches draft mutations outside actions (watch listener queues `_update`)
- Batches model manager notifications (`_onModelChange` queues global notification)
- Inside actions: `_update` called synchronously at depth=0, bypassing the scheduler

---

## 5. React's Constraints for Reactivity Integration

For a reactivity system to serve React components, it must satisfy several constraints imposed by React's rendering model.

### 5.1 Immutability Requirement

React determines whether to re-render by comparing state references. `useSyncExternalStore` compares `getSnapshot()` return values with `Object.is()`. If the state object is mutated in place (as in Vue's reactive system), `Object.is(prev, next)` is always `true` — React never re-renders.

**Constraint**: The external state consumed by React must be an immutable snapshot. Mutations must produce new references for changed sub-trees while preserving references for unchanged sub-trees (structural sharing).

### 5.2 useSyncExternalStore Contract

React 18's `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` is the official API for external state stores. Its contract:

1. **`getSnapshot()`** must return a cached/memoized value. It's called during render (synchronous, no side effects). If it returns a different reference on every call, React enters an infinite re-render loop.
2. **`subscribe(callback)`** must register a callback that React calls when the store changes. Returns an unsubscribe function.
3. **Consistency**: `getSnapshot()` must return the same value between `subscribe` callback firing and the next render. React may call `getSnapshot()` multiple times during a single render cycle — it must be idempotent.
4. **Tearing prevention**: During concurrent rendering, React may pause and resume. If the store changes during a paused render, `getSnapshot()` is called again — if the value changed, React discards the paused work and starts over.

**Constraint**: The reactivity system must provide a stable `getSnapshot()` that returns the same reference until a genuine change occurs, and a `subscribe` mechanism that notifies React of changes.

### 5.3 Referential Equality for Bailout

React's performance model relies on referential equality (`===`) for skip-render decisions:
- `useSyncExternalStore` skips re-render if `getSnapshot()` returns the same reference
- `React.memo` skips re-render if all props are `===` equal
- `useMemo` / `useCallback` return cached values when deps are `===` equal

**Constraint**: The snapshot system must provide structural sharing — unchanged sub-trees must return the same object reference across snapshots.

### 5.4 Batching

React batches state updates within event handlers (and since React 18, within `setTimeout`, promises, etc.). Multiple `setState` calls in a single event handler produce one re-render.

External stores must coordinate with React's batching:
- `unstable_batchedUpdates(fn)` wraps multiple subscriber notifications into a single render pass
- Without batching, each model change triggers an independent re-render, causing intermediate inconsistent states

**Constraint**: When multiple models change in response to a single action, all React subscriber notifications must be batched into a single render pass.

### 5.5 No Proxy Leakage

React components may pass state values to third-party libraries, serialize them (JSON.stringify), or compare them with `===`. Proxy objects behave differently from plain objects in subtle ways:
- `JSON.stringify` on a Proxy triggers all GET traps
- `===` comparison between a Proxy and a plain object is always false
- `Object.keys`, `for...in`, spread operators all trigger traps

**Constraint**: State values consumed by React must be plain JavaScript objects, not Proxy wrappers. Draft proxies must never leak into component render output.

### 5.6 Summary of Constraints

| Constraint | What it means |
|---|---|
| Immutability | External state must be a new reference when changed |
| Stable getSnapshot | Must return cached value, idempotent, no side effects |
| Structural sharing | Unchanged sub-trees keep same reference (===) |
| Batching | Multiple changes → single render pass |
| No proxy leakage | All consumed values are plain objects, not Proxies |
| Concurrent safety | getSnapshot must be consistent across paused/resumed renders |

---

## 6. React Integration (`packages/react-doura/src/`)

### 6.1 How Doura Satisfies React's Constraints

| React Constraint | Doura Mechanism |
|---|---|
| Immutability | `snapshot()` produces plain value trees; draft proxies never returned externally |
| Stable getSnapshot | Model caches `immutableState`; `getSnapshot()` returns cached reference until `_update()` produces new snapshot |
| Structural sharing | `_lastDraftToSnapshot` cache maps draft proxy → resolved value across snapshots |
| Batching | `batchManager` wraps notifications in `unstable_batchedUpdates` |
| No proxy leakage | `PublicInstanceProxyHandlers` reads from `getState()` (snapshot), not live draft |
| Concurrent safety | `useSyncExternalStore` handles tearing; `getSnapshot()` is pure read from cached snapshot |

### 6.2 createContainer

```ts
createContainer(options?):
  1. Creates a Doura instance (ModelManager) and BatchManager
  2. Wraps in React Context via Context.Provider
  3. Returns { Provider, useSharedModel, useStaticModel }
```

Supports external store injection via `props.store`. A global default container exists for app-wide shared models.

### 6.3 createUseModel (Core Hook)

**Without selector** (`useModel(model)`):
```
1. Get model instance from manager
2. view = () => model.$getApi()  (returns {state, views, actions})
3. useSyncExternalStore(subscribe, view, view)
```

**With selector** (`useModel(model, selector, deps?)`):
```
1. Get model instance from manager
2. modelView = model.$createView(selector)  — creates a reactive ViewImpl
3. getSnapshot = () => modelView.getSnapshot()
4. useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
5. On deps change: destroy old view, create new one
```

The selector path creates a `ViewImpl` that tracks fine-grained dependencies. Only changes to properties the selector actually reads will trigger re-render.

### 6.4 useStaticModel

Returns the model instance directly (or dev-mode read-only proxy), without `useSyncExternalStore`. The component does NOT re-render on state changes. Intended for write-only access (calling actions without reading state).

### 6.5 BatchManager

```ts
batchManager:
  addSubscribe(model, fn):
    1. Register render callback for model
    2. On first subscriber for model: model.$subscribe() → listen for changes
    3. On model change: triggerSubscribe(model)

  triggerSubscribe(model):
    1. Collect all registered callbacks for model
    2. unstable_batchedUpdates(() => {
         callbacks.forEach(fn => fn())
       })

  Cleanup: when last subscriber unsubscribes, model.$subscribe handler removed
```

### 6.6 useModel Entry Point

Dispatches based on arguments:
- String first arg (named model): delegates to global container's `useRootModel`
- Model object first arg (anonymous): creates per-component `Doura` instance via `useRef`, delegates to `createUseModel`

---

## 7. Key Invariants

These are the critical rules that the system must maintain for correctness.

### 7.1 DraftState Identity Preserved via childDrafts

DraftState identity across actions is preserved via the `childDrafts` Map on each DraftState, NOT via draft proxy refs in `state.base`. After `stealAndReset` + `resolveStates`, `state.base` contains resolved plain values (no draft proxies). The GET trap checks `state.childDrafts.get(prop)` first — if found, returns the existing child draft proxy, preserving DraftState identity and `targetMap` entries.

**If violated**: If `childDrafts` is lost or corrupted, the GET trap creates new DraftStates for the same properties, losing dependency chain continuity in `targetMap`. Views stop reacting to changes on those properties.

**Cleanup**: `childDrafts` entries are invalidated by SET/DELETE on the same key (`childDrafts.delete(prop)`). `resetDraftChildren` (called by `replace()`) clears `childDrafts` entirely. Size is bounded by the number of object-typed properties accessed on the node.

### 7.2 Snapshot Contains No Draft Proxies

All values in the snapshot tree must be plain JavaScript objects. No draft proxy may be reachable from any snapshot value.

**If violated**: Mutable state leaks to React components; `JSON.stringify` triggers traps; `===` comparisons break; proxy identity prevents structural sharing.

### 7.3 Structural Sharing Across Snapshots

Unchanged sub-trees return the same reference (`===`) across consecutive snapshots. The `_lastDraftToSnapshot` cache is the mechanism.

**If violated**: React re-renders components unnecessarily; `useMemo`/`React.memo` bailouts fail.

### 7.4 Synchronous Snapshot After Action

When an action completes at depth 0, `_update()` runs synchronously (not deferred to microtask). The snapshot is immediately available.

**If violated**: Code that calls an action and immediately reads state sees stale values.

### 7.5 View mightChange Propagation

`triggerDraft` must walk the full parent chain and set `mightChange = true` on all views that tracked any level. `mightChange` must be reset after the view's `getSnapshot()` is called.

**If violated**: Views return stale snapshots (false negative: missed change) or regenerate snapshots unnecessarily (false positive: wasted work, but not incorrect).

### 7.6 Children Array and childDrafts Consistency

Every child DraftState created via lazy drafting in GET trap must be registered in both `parent.children` (via `addChildRef` in `draft()`) and `parent.childDrafts` (via `childDrafts.set(prop, child)` in the GET trap). Every removed/overwritten child must be unregistered: `removeChildRef` for `children`, `childDrafts.delete(prop)` for `childDrafts`.

**If `children` violated**: BFS in `snapshot()` misses modified children → `resolveStates` doesn't resolve them → draft proxies leak into snapshot (violates 7.2).

**If `childDrafts` violated**: GET trap creates duplicate DraftStates for the same property → DraftState identity fragmented → dependency chains in `targetMap` split across multiple DraftStates → views may miss changes or track stale deps.

**Note**: `childDrafts` stores entries by property key (Map key → draft proxy). `children` stores entries by DraftState reference (array of DraftState). Both track the same child drafts but serve different purposes: `childDrafts` for GET trap reuse + snapshot resolution by key, `children` for BFS traversal of modified tree.
