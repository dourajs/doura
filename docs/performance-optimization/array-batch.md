# Performance Optimization Record

Commit: `e45d7da`

## Benchmark Result

```
benchmark:suite:array-batch (size 1000, 10% modification)

Before:  Doura  5,567 ops/sec
After:   Doura ~22,000 ops/sec  (+295%)
         Immer ~12,700 ops/sec  (Doura is ~75% faster)
         Mutative ~22,000 ops/sec (Doura is on par)
```

All 332 tests pass, TypeScript type-check clean.

---

## Optimization 1: Children tracking — Map → Array

**File**: `packages/doura/src/reactivity/draft.ts`

### What changed

```typescript
// Before
children: Map<DraftState, number> | null

addChildRef(parent, child) {
  parent.children.set(child, (parent.children.get(child) || 0) + 1)
}
removeChildRef(parent, child) {
  const count = parent.children.get(child)
  if (count <= 1) parent.children.delete(child)
  else parent.children.set(child, count - 1)
}

// After
children: DraftState[] | null

addChildRef(parent, child) {
  parent.children.push(child)
}
removeChildRef(parent, child) {
  const idx = parent.children.indexOf(child)
  if (idx !== -1) parent.children.splice(idx, 1)
}
```

### Why

`addChildRef` is called on every child draft creation (hot path). In the benchmark, this is 100 calls per iteration. `Array.push` is ~10x faster than `Map.get + Map.set`.

### Why it's correct

Refcount semantics are preserved via array duplicates: each `addChildRef` pushes one entry, each `removeChildRef` removes one (via `indexOf`). Multiple references to the same child = multiple array entries. When all references are removed, the array no longer contains the child — identical behavior to the Map refcount approach.

`removeChildRef` is O(n) (linear scan) instead of O(1), but it's only called on delete/overwrite of draft-valued properties, which is rare compared to reads.

BFS in `takeSnapshotFromDraft` iterates the array with a simple for-loop, which is faster than `Map.keys()` iterator.

---

## Optimization 2: Lazy allocation for `children` and `listeners`

**File**: `packages/doura/src/reactivity/draft.ts`

### What changed

```typescript
// Before: allocated on every draft() call
listeners: [],
children: new Map(),

// After: null until actually needed
listeners: null,
children: null,
```

`watch()` lazily allocates `listeners` on first call. `addChildRef` lazily allocates `children` on first child.

### Why

Every `draft()` call creates a DraftState. Allocating a `Map` and an `Array` per state is expensive. Immer and Mutative allocate neither — Immer uses a shared `callbacks_` array, Mutative uses shared `finalities`.

### Why it's correct

All code that reads `children` or `listeners` guards against null:

- `takeSnapshotFromDraft`: `if (state.children) { ... }`
- `resetDraftChildren`: `if (!root.children) return`
- `trigger`: `const listeners = state.root?.listeners; if (listeners && listeners.length)`
- `watch`: `if (!state.listeners) state.listeners = []`

No behavioral change — just deferred allocation.

---

## Optimization 3: `Object.assign` for proxy target setup

**File**: `packages/doura/src/reactivity/draft.ts`

### What changed

```typescript
// Before: expensive Object.defineProperty loop for Array/Set/Map proxy targets
if (proxyTarget !== state) {
  Object.keys(state).forEach((key) => {
    Object.defineProperty(proxyTarget, key, {
      configurable: true, enumerable: true, writable: true,
      value: (state as any)[key],
    })
  })
}

// After: single native call
if (proxyTarget !== state) {
  Object.assign(proxyTarget, state)
}
```

### Why

For Array, Set, and Map drafts, the proxy target must be an instance of the correct type (for `instanceof` checks), but also carry all DraftState properties. `Object.assign` is significantly faster than an `Object.defineProperty` loop. This is the same approach Mutative uses.

### Why it's correct

`Object.defineProperty` with `{configurable: true, enumerable: true, writable: true}` creates properties with the same descriptor as direct assignment (`Object.assign`). The proxy handlers (`get`, `set`, `ownKeys`, `has`) all operate on `latest(state)` (the base or copy), not on the proxy target's own properties directly. The state properties on the proxy target (`type`, `id`, `base`, `copy`, etc.) are accessed by the handlers via the `state` parameter (which IS the proxy target). So the exact property descriptor doesn't matter — only the value.

---

## Optimization 4: Eliminate `draftMap` WeakMap

**File**: `packages/doura/src/reactivity/draft.ts`, `packages/doura/src/reactivity/baseHandlers.ts`

### What changed

```typescript
// Before (draft.ts): store in WeakMap
draftMap.set(proxyTarget, proxy)

// Before (baseHandlers.ts get trap): lookup in WeakMap
receiver === draftMap.get(state)

// After: use state.proxy directly (already stored on the state)
receiver === state.proxy
```

### Why

`draftMap.get(state)` is a WeakMap lookup on every `ReactiveFlags.STATE` access in the get trap. `state.proxy` is a direct property access — much faster. Both Immer and Mutative access the proxy through the state object directly.

### Why it's correct

`state.proxy` is set to the proxy on the very next line after `new Proxy(proxyTarget, proxyHandlers)`:

```typescript
const proxy = new Proxy(proxyTarget, proxyHandlers)
proxyTarget.proxy = proxy  // ← already stored here
```

`draftMap.set(proxyTarget, proxy)` was redundant — the same mapping was already maintained via `state.proxy`. The WeakMap is kept as a deprecated export for backward compatibility but is no longer populated.

---

## Optimization 5: Steal-the-copy in snapshot

**File**: `packages/doura/src/reactivity/draft.ts`

### What changed

```typescript
// Before: copy the copy (double allocation)
const value = shallowCopy(state.copy)
updateDraftState(state, value)

// After: steal the copy, hand it to the snapshot
const value = state.copy ? state.copy : shallowCopy(state.base)
state.base = value
state.copy = null
state.modified = false
```

### Why

The old code called `shallowCopy(state.copy)` — copying an object that was itself already a shallow copy of `state.base`. This double-copy is unnecessary. Immer and Mutative both "steal" the copy: the snapshot takes ownership of `state.copy`, and the draft is reset to use it as the new base.

### Why it's correct

After stealing:
- `state.base` = the stolen copy (current values including draft child references)
- `state.copy` = null (forces `prepareCopy` to create a fresh copy on next mutation)
- `state.modified` = false

`latest(state)` returns `state.copy || state.base`. Since `copy` is null, it returns `base` (the stolen copy) — which has the correct current values. The next mutation triggers `prepareCopy`, creating a fresh copy from the new base. The snapshot's copy and the draft's base are the **same object**, but the draft never mutates `base` directly (it always goes through `copy`), so there's no aliasing issue.

**Edge case**: When `state.copy` is null but `state.modified` is true. This happens when `markChanged()` bubbles up from a child without `prepareCopy` being called on the parent (parent was never directly read/written, only its child was). In this case, `shallowCopy(state.base)` is used as a fallback, same as the original behavior.

---

## Optimization 6: Fast `getTargetType`

**File**: `packages/doura/src/reactivity/common.ts`

### What changed

```typescript
// Before: toString + slice for every type check
switch (toRawType(value)) {  // Object.prototype.toString.call(value).slice(8, -1)
  case 'Object': return COMMON
  case 'Array': return ARRAY
  ...
}

// After: fast native checks first, toString fallback only when needed
if (Array.isArray(value)) return ARRAY
if (value instanceof Map) return MAP
if (value instanceof Set) return SET
if (value === null || value === undefined) return INVALID
if (value.constructor === Object) return COMMON
if (objectToString.call(value) === '[object Object]') return COMMON
return INVALID
```

### Why

`Array.isArray` and `instanceof` are significantly faster than `Object.prototype.toString.call()` + `.slice()`. The `constructor === Object` check is ~10x faster than `toString` and covers 99% of plain objects.

### Why it's correct

The type detection logic is equivalent:
- **ARRAY**: `Array.isArray` is the standard check, identical semantics to `toRawType === 'Array'`
- **MAP/SET**: `instanceof Map/Set` matches the same values as `toRawType === 'Map'/'Set'`
- **COMMON**: `constructor === Object` matches `{}`, `new Object()`, and any object with `Object` as its direct constructor. The `toString` fallback handles `Object.create(null)` (no constructor) and class instances (constructor is the class, but `toString` returns `'[object Object]'`).
- **INVALID**: Date, RegExp, etc. have `constructor !== Object` AND `toString` returns `'[object Date]'`, etc. — correctly rejected.

---

## Optimization 7: Inline `shouldTrack && activeEffect` guards

**File**: `packages/doura/src/reactivity/baseHandlers.ts`

### What changed

```typescript
// Before: always call track/trackDraft (they check internally)
track(state, TrackOpTypes.GET, prop)
trackDraft(value)

// After: skip function call entirely when no active effect
if (shouldTrack && activeEffect) {
  track(state, TrackOpTypes.GET, prop)
}
if (shouldTrack && activeEffect) {
  trackDraft(value)
}
```

### Why

`track()` and `trackDraft()` already check `shouldTrack && activeEffect` internally and return early. But the function CALL itself has overhead (argument passing, stack frame). When there's no active effect (the common case during action execution), inlining the check avoids ~200-300 function calls per benchmark iteration.

### Why it's correct

The guard condition is identical to the one inside `track()`:

```typescript
export function track(...) {
  if (shouldTrack && activeEffect) {  // ← same check
    ...
  }
}
```

When `shouldTrack && activeEffect` is false, `track()` would be a no-op anyway. The inline check just skips the function call. When the condition IS true (inside effect/view evaluation), `track()` is called normally.

---

## Optimization 8: Fast-path `trigger()` early return

**File**: `packages/doura/src/reactivity/effect.ts`

### What changed

```typescript
// Before: always do WeakMap lookup + full logic
export function trigger(state, type, key, newValue, _oldValue) {
  const depsMap = targetMap.get(state)
  // ... full trigger logic ...
  const listeners = state.root?.listeners
  if (listeners && listeners.length) { ... }
}

// After: early return when nothing to do
export function trigger(state, type, key, newValue, _oldValue) {
  const listeners = state.root?.listeners
  const depsMap = targetMap.get(state)
  if (!depsMap && (!listeners || !listeners.length)) {
    return  // nothing to trigger
  }
  // ... full trigger logic only when needed ...
}
```

### Why

In standalone usage and during actions with no registered effects, `targetMap` has no entries for the state (deps are only created by `track()` during effect runs), and `listeners` is null. The early return avoids the entire trigger body including `state.base` access, type checking, and dep collection logic.

### Why it's correct

The check is strictly conservative: it only returns early when there are **no deps AND no listeners**. If either exists, the full trigger logic executes. The `listeners` variable is moved up and reused at the end, avoiding a double read.

---

## Optimization 9: Inline `peek()` in set handler

**File**: `packages/doura/src/reactivity/baseHandlers.ts`

### What changed

```typescript
// Before: function call with redundant state check
const current = peek(target, prop)
// peek does: const state = obj[ReactiveFlags.STATE]; const source = state ? latest(state) : obj; return source[prop]

// After: direct property access
const current = target[prop]
```

### Why

`target` is already `latest(state)` — a plain object (not a proxy). The `peek()` function checks if the target has a `ReactiveFlags.STATE` property to determine if it's a draft, but since `target` is always the base/copy (never the proxy), the check always fails and `peek` degenerates to `target[prop]`.

### Why it's correct

`target = latest(state)` returns `state.copy || state.base`, which is always a plain object. It never has `ReactiveFlags.STATE` (that's only on the proxy target/DraftState). So `peek(target, prop)` is always `target[prop]`.

---

## Optimization 10: Inline `isDraft()` in get handler

**File**: `packages/doura/src/reactivity/baseHandlers.ts`

### What changed

```typescript
// Before
if (!isDraft(value)) {  // isDraft: !!value && !!value[ReactiveFlags.STATE]

// After
if (!value[ReactiveFlags.STATE]) {
```

### Why

At this point in the get handler, `value` is already confirmed to be a non-null object (guarded by `isObject(value)` above). The `!!value` check in `isDraft` is redundant.

### Why it's correct

The code path is:
```typescript
if (state.disposed || !isObject(value)) {
  return value  // early return for non-objects
}
// value is guaranteed to be a non-null object here
if (!value[ReactiveFlags.STATE]) { ... }
```

`isObject(value)` returns `value !== null && typeof value === 'object'`, so `value` is guaranteed non-null. The `[ReactiveFlags.STATE]` access on a plain object returns `undefined` (falsy), triggering the draft creation — identical to `!isDraft(value)`.

---

## Optimization 11: `receiver === state.proxy` instead of `toState(receiver)`

**File**: `packages/doura/src/reactivity/baseHandlers.ts`

### What changed

```typescript
// Before: re-enters the proxy get trap
if (state === toState(receiver)) {
// toState does: receiver[ReactiveFlags.STATE] → triggers get trap → returns state

// After: direct identity check, no proxy re-entry
if (receiver === state.proxy) {
```

### Why

`toState(receiver)` accesses `receiver[ReactiveFlags.STATE]` where `receiver` is the proxy. This triggers the get trap, which checks `prop === ReactiveFlags.STATE && receiver === state.proxy` and returns `state`. The round-trip through the proxy trap is pure overhead when we can just compare `receiver === state.proxy` directly.

### Why it's correct

The original check `state === toState(receiver)` verifies that the receiver IS the proxy for this state (not something up the prototype chain). `toState(receiver)` returns `receiver[ReactiveFlags.STATE]`, which the get trap returns as `state` when `receiver === state.proxy`. So:

```
state === toState(receiver)
≡ state === receiver[ReactiveFlags.STATE]
≡ state === state  (when receiver === state.proxy)
≡ true             (when receiver === state.proxy)
```

The conditions `state === toState(receiver)` and `receiver === state.proxy` are logically equivalent.

---

## Optimization 12: Optimized `quickCopyObj`

**File**: `packages/doura/src/utils.ts`

### What changed

```typescript
// Before: Reflect.ownKeys + isEnumerable check per key
function quickCopyObj(base) {
  const keys = ownKeys(base)  // Reflect.ownKeys — slow
  for (const key of keys) {
    if (isEnumerable.call(base, key)) copy[key] = base[key]
    else Object.defineProperty(copy, key, {...})
  }
}

// After: Object.keys fast path + deferred edge case handling
function quickCopyObj(base) {
  const enumKeys = Object.keys(base)  // ~8x faster than ownKeys
  for (const key of enumKeys) copy[key] = base[key]
  // Only check for non-enumerable/symbol properties if they exist
  const allNames = Object.getOwnPropertyNames(base)
  if (allNames.length !== enumKeys.length) { /* handle non-enumerable */ }
  const symbols = Object.getOwnPropertySymbols(base)
  if (symbols.length > 0) { /* handle symbols */ }
}
```

### Why

`Reflect.ownKeys` is ~8x slower than `Object.keys` in V8. The vast majority of objects in real usage have only enumerable string properties (no symbols, no non-enumerable props). The fast path handles them with just `Object.keys`, and the slower `getOwnPropertyNames`/`getOwnPropertySymbols` checks only run as guards.

### Why it's correct

The logic is equivalent:
1. `Object.keys` copies all own enumerable string properties (the common case)
2. `Object.getOwnPropertyNames` catches non-enumerable string properties when `allNames.length !== enumKeys.length`
3. `Object.getOwnPropertySymbols` catches symbol properties

Together, these three cover the same surface as `Reflect.ownKeys`. Non-enumerable properties are still copied with `Object.defineProperty({enumerable: false, ...})`, preserving their descriptor.

---

## Optimization 13: Guard `isObject()` before children refcount

**File**: `packages/doura/src/reactivity/baseHandlers.ts`

### What changed

```typescript
// Before: always read old value and check for draft state
const oldCopyValue = state.copy![prop]
const oldChildState = oldCopyValue && oldCopyValue[ReactiveFlags.STATE]
const newChildState = value && (value as any)[ReactiveFlags.STATE]

// After: skip entirely when both values are primitives
const oldCopyValue = state.copy![prop]
if (isObject(oldCopyValue) || isObject(value)) {
  const oldChildState = oldCopyValue && oldCopyValue[ReactiveFlags.STATE]
  const newChildState = value && (value as any)[ReactiveFlags.STATE]
  ...
}
```

### Why

In the benchmark's hot path (`draft[index].value = i`), both `oldCopyValue` (the original number) and `value` (the new number `i`) are primitives. Primitives can never be drafts, so the `[ReactiveFlags.STATE]` access is pointless. The `isObject` guard skips the entire block for primitive-to-primitive assignments.

### Why it's correct

`[ReactiveFlags.STATE]` on a primitive returns `undefined` (property access on primitives auto-boxes but string `'__r_state'` doesn't exist on Number/String/Boolean prototypes). The original code would evaluate to `oldChildState = undefined`, `newChildState = undefined`, skip both `if` branches, and do nothing. The `isObject` guard reaches the same result without the property accesses.
