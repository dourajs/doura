# Flat Finalization Callback + assignedMap Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `finalizeDraft`'s tree-walk (BFS + `resolveDraftRefs` + `needsScan`) with Mutative's flat finalization callback + `assignedMap` approach, eliminating all patch mechanisms (`hasDraftableAssignment`, `childBases`, `finalizeDraftValue`, `getOwnPropertyDescriptor` safety, `needsScan`).

**Architecture:** Each child draft registers a finalization callback in a flat array on the root state at creation time. Each DraftState gets a lazily-created `assignedMap` tracking user-set/deleted keys. On finalization, save `finalities.length` as the child-draft count (before popping — equivalent to Mutative's `revoke.length > 1`), pop all callbacks (LIFO, leaf-first) to resolve direct child proxies, then skip or walk `assignedMap` entries based on the child count. This decouples finalization from the `children` tree structure and handles orphan drafts, renames, multi-references, and nested-in-plain-object leaks uniformly.

**Tech Stack:** TypeScript, Proxy-based draft system (packages/doura/src/reactivity/)

**Validation rule:** Zero test modifications. All 350 tests (345 pass + 5 skipped) must remain unchanged.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/doura/src/reactivity/draft.ts` | Add `finalities` to `DraftStateBase`, rewrite `finalizeDraft`, rewrite `handleValue`, remove `resolveDraftRefs`/`finalizeDraftValue` |
| Modify | `packages/doura/src/reactivity/baseHandlers.ts` | Add `assignedMap` tracking in set/delete traps, register finalization callback in get trap |
| Modify | `packages/doura/src/reactivity/collectionHandlers.ts` | Add `assignedMap` tracking in Map set/delete, Set add, register finalization callback in Map get |

---

### Task 1: Add `finalities` and `assignedMap` to DraftStateBase

**Files:**
- Modify: `packages/doura/src/reactivity/draft.ts:26-57` (DraftStateBase interface)
- Modify: `packages/doura/src/reactivity/draft.ts:129-142` (state initialization in `draft()`)

- [ ] **Step 1: Add `finalities` and `assignedMap` fields to `DraftStateBase`**

In `packages/doura/src/reactivity/draft.ts`, update the `DraftStateBase` interface. Remove `hasDraftableAssignment`. Add `finalities` (on root only) and `assignedMap` (per-state, lazy).

```ts
interface DraftStateBase<T extends AnyObject = AnyObject> {
  id: number
  root: DraftState
  parent?: DraftState
  key: any
  base: T
  proxy: T
  copy: T | null
  modified: boolean
  disposed: boolean
  // Flat finalization callbacks (root only).
  // Every child draft pushes a callback at creation time.
  // Popped LIFO during finalizeDraft for leaf-first resolution.
  finalities: Array<() => void> | null
  // Tracks which keys were user-assigned (true) or deleted (false).
  // Lazily created on first set/delete. Used by finalization to know
  // which keys need handleValue scanning.
  assignedMap: Map<any, boolean> | null
  listeners: Array<() => void> | null
  children: DraftState[] | null
}
```

- [ ] **Step 2: Initialize `finalities` and `assignedMap` in `draft()`**

In the `draft()` function, initialize the two new fields:

```ts
let state: DraftState = {
  type: DraftType.Object,
  id: uid++,
  root: null as any,
  parent: parent,
  key: arguments.length >= 3 ? key : NO_KEY,
  base: target,
  proxy: null as any,
  copy: null,
  modified: false,
  disposed: false,
  finalities: null, // set on root below
  assignedMap: null, // lazy, created on first set/delete
  listeners: null,
  children: null,
}
```

After the root/parent assignment block, initialize `finalities` on root:

```ts
if (parent) {
  proxyTarget.root = parent.root
  addChildRef(parent, proxyTarget)
} else {
  proxyTarget.root = proxyTarget
  proxyTarget.finalities = [] // root owns the flat callback array
}
```

- [ ] **Step 3: Run tests to verify no regressions**

Run: `pnpm test-unit 2>&1 | tail -5`
Expected: `Tests: 5 skipped, 345 passed, 350 total`

- [ ] **Step 4: Commit**

```bash
git add packages/doura/src/reactivity/draft.ts
git commit -m "refactor: add finalities and assignedMap fields to DraftStateBase

Preparation for flat finalization callback approach. finalities is a
flat array on root for LIFO child callback registration. assignedMap
tracks user-set/deleted keys per state for targeted handleValue scans.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Register finalization callbacks in Object/Array get trap

**Files:**
- Modify: `packages/doura/src/reactivity/baseHandlers.ts:99-146` (createGetter)

When a child draft is created in the get trap (the `if (!value[ReactiveFlags.STATE])` branch), register a finalization callback on the root's `finalities` array. The callback captures `state` (parent), `prop` (current key), and the child proxy.

- [ ] **Step 1: Import `DraftState` type (already imported) and add callback registration**

In `createGetter()` in `baseHandlers.ts`, after the line `value = state.copy![prop as any] = draft(value, state, prop)`, add the finalization callback:

```ts
function createGetter(): ProxyGetter {
  return function get(
    state: ObjectDraftState,
    prop: PropertyKey,
    receiver: object
  ) {
    // ... existing code up to the draft creation block ...

    if (!value[ReactiveFlags.STATE]) {
      prepareCopy(state)
      value = state.copy![prop as any] = draft(value, state, prop)
      // Register flat finalization callback on root.
      // Captures parent state, the key at creation time, and the child proxy.
      // At finalization time, checks if the child proxy is still at this key
      // in the parent's copy. If so, replaces it with the finalized base value.
      const childProxy = value
      state.root.finalities!.push(() => {
        const parentCopy = state.copy ? state.copy : state.base
        if (parentCopy[prop as any] === childProxy) {
          const childState: DraftState = childProxy[ReactiveFlags.STATE]
          parentCopy[prop as any] = childState.base
        }
      })
    }

    trackDraft(value)

    return value
  }
}
```

- [ ] **Step 2: Run tests to verify no regressions**

Run: `pnpm test-unit 2>&1 | tail -5`
Expected: `Tests: 5 skipped, 345 passed, 350 total`

- [ ] **Step 3: Commit**

```bash
git add packages/doura/src/reactivity/baseHandlers.ts
git commit -m "refactor: register finalization callback in Object/Array get trap

Each child draft created via property access pushes a callback to
root.finalities. The callback resolves the draft proxy at its original
key position during finalization.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Register finalization callbacks in Map get trap

**Files:**
- Modify: `packages/doura/src/reactivity/collectionHandlers.ts:70-93` (Map get function)

Same pattern as Task 2 but for Map entries.

- [ ] **Step 1: Add callback registration after Map draft creation**

In the `get()` function in `collectionHandlers.ts`, after `state.copy!.set(key, value)`:

```ts
function get(this: AnyMap & Drafted, key: unknown) {
  const state = this[ReactiveFlags.STATE] as MapDraftState
  const target = latest(state)
  track(state, TrackOpTypes.GET, key)

  if (!target.has(key)) {
    return
  }

  let value = target.get(key)
  if (!isObject(value)) {
    return value
  }

  if (!isDraft(value)) {
    prepareCopy(state)
    value = draft(value, state, key)
    state.copy!.set(key, value)
    // Register flat finalization callback for this Map child.
    const childProxy = value
    state.root.finalities!.push(() => {
      const parentCopy = state.copy ? state.copy : state.base
      if (parentCopy.get(key) === childProxy) {
        const childState: DraftState = childProxy[ReactiveFlags.STATE]
        parentCopy.set(key, childState.base)
      }
    })
  }

  trackDraft(value)

  return value
}
```

- [ ] **Step 2: Run tests to verify no regressions**

Run: `pnpm test-unit 2>&1 | tail -5`
Expected: `Tests: 5 skipped, 345 passed, 350 total`

- [ ] **Step 3: Commit**

```bash
git add packages/doura/src/reactivity/collectionHandlers.ts
git commit -m "refactor: register finalization callback in Map get trap

Map child drafts now push callbacks to root.finalities, mirroring the
Object/Array pattern from the previous commit.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Add `assignedMap` tracking in Object/Array set and delete traps

**Files:**
- Modify: `packages/doura/src/reactivity/baseHandlers.ts:150-234` (createSetter)
- Modify: `packages/doura/src/reactivity/baseHandlers.ts:236-261` (deleteProperty)

- [ ] **Step 1: Track assignments in the set trap**

In `createSetter()`, after `markChanged(state)` (the block that prepares copy and marks changed), and after the `state.copy![prop] = value` assignment, add `assignedMap` tracking. Replace the `hasDraftableAssignment` flag with `assignedMap`:

In the set trap, after the children tracking block (the `if (isObject(oldCopyValue) || isObject(value))` block), replace the `hasDraftableAssignment` line and add `assignedMap` tracking before the trigger block:

```ts
    // Maintain children tracking: remove old draft child, add new one.
    const oldCopyValue = state.copy![prop]
    if (isObject(oldCopyValue) || isObject(value)) {
      const oldChildState: DraftState | undefined =
        oldCopyValue && oldCopyValue[ReactiveFlags.STATE]
      const newChildState: DraftState | undefined =
        value && (value as any)[ReactiveFlags.STATE]
      if (oldChildState) {
        removeChildRef(state, oldChildState)
      }
      if (newChildState) {
        addChildRef(state, newChildState)
        newChildState.key = prop
      }
    }

    state.copy![prop] = value

    // Track this key as user-assigned for finalization.
    // assignedMap.set(key, true) means "user wrote to this key".
    // Check if value equals original — if so, un-mark (same as Mutative).
    if (hasOwn(state.base, prop) && is(value, (state.base as any)[prop])) {
      if (state.assignedMap) state.assignedMap.delete(prop)
    } else {
      if (!state.assignedMap) state.assignedMap = new Map()
      state.assignedMap.set(prop, true)
    }
```

Note: The `state.copy![prop] = value` assignment must move to before the `assignedMap` tracking (it's currently already in the right place in the existing code, just need to add the tracking after it). Actually, looking at the existing code more carefully, `state.copy![prop] = value` is inside the children tracking block. We need to keep the existing assignment location and add the `assignedMap` lines right after.

- [ ] **Step 2: Track deletions in the delete trap**

In `deleteProperty()`, after the `delete state.copy[prop]` line, add:

```ts
    // Track this key as deleted for finalization.
    if (!state.assignedMap) state.assignedMap = new Map()
    state.assignedMap.set(prop, false)
```

- [ ] **Step 3: Run tests to verify no regressions**

Run: `pnpm test-unit 2>&1 | tail -5`
Expected: `Tests: 5 skipped, 345 passed, 350 total`

- [ ] **Step 4: Commit**

```bash
git add packages/doura/src/reactivity/baseHandlers.ts
git commit -m "refactor: add assignedMap tracking in Object/Array set/delete traps

Set trap marks keys as assigned (true), delete trap marks as deleted
(false). Assigning back the original value un-marks the key. This
replaces the hasDraftableAssignment flag for targeted finalization.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Add `assignedMap` tracking in Map set/delete and Set add

**Files:**
- Modify: `packages/doura/src/reactivity/collectionHandlers.ts:95-132` (Map set function)
- Modify: `packages/doura/src/reactivity/collectionHandlers.ts:134-150` (Set add function)
- Modify: `packages/doura/src/reactivity/collectionHandlers.ts:193-222` (deleteEntry function)

- [ ] **Step 1: Track Map set assignments**

In the Map `set()` function, inside `_doSet()`, after `state.copy!.set(key, value)` and the children tracking block, add:

```ts
  const _doSet = () => {
    prepareCopy(state)
    markChanged(state)
    // Decrement refcount for old child draft when overwriting
    if (hadKey) {
      const oldCopy = state.copy!.get(key)
      if (oldCopy && isDraft(oldCopy)) {
        removeChildRef(state, oldCopy[ReactiveFlags.STATE] as DraftState)
      }
    }
    state.copy!.set(key, value)
    // Track new child draft
    if (value && isDraft(value as any)) {
      const childState = (value as any)[ReactiveFlags.STATE] as DraftState
      addChildRef(state, childState)
      childState.key = key
    }
    // Track this key as user-assigned for finalization.
    if (hadKey && state.base.has(key) && is(value, state.base.get(key))) {
      if (state.assignedMap) state.assignedMap.delete(key)
    } else {
      if (!state.assignedMap) state.assignedMap = new Map()
      state.assignedMap.set(key, true)
    }
  }
```

Remove the `hasDraftableAssignment` line (`state.root.hasDraftableAssignment = true`).

- [ ] **Step 2: Track Set add assignments**

In the `add()` function, after `state.copy!.add(value)` and the children tracking, add:

```ts
function add(this: AnySet & Drafted, value: unknown) {
  const state = this[ReactiveFlags.STATE] as SetDraftState
  const target = latest(state)
  const hadKey = target.has(value) || state.drafts.has(value as any)
  if (!hadKey) {
    prepareSetCopy(state)
    markChanged(state)
    state.copy!.add(value)
    if (value && isDraft(value as any)) {
      addChildRef(state, (value as any)[ReactiveFlags.STATE] as DraftState)
    }
    // Track this value as assigned for finalization.
    if (!state.assignedMap) state.assignedMap = new Map()
    state.assignedMap.set(value, true)
    trigger(state, TriggerOpTypes.ADD, value, value)
  }
  return this
}
```

- [ ] **Step 3: Track Map/Set deletions in deleteEntry**

In `deleteEntry()`, after `state.copy!.delete(key)`, add:

```ts
  if (!state.assignedMap) state.assignedMap = new Map()
  state.assignedMap.set(key, false)
```

- [ ] **Step 4: Run tests to verify no regressions**

Run: `pnpm test-unit 2>&1 | tail -5`
Expected: `Tests: 5 skipped, 345 passed, 350 total`

- [ ] **Step 5: Commit**

```bash
git add packages/doura/src/reactivity/collectionHandlers.ts
git commit -m "refactor: add assignedMap tracking in Map set/delete and Set add

Map set marks keys as assigned, Map/Set delete marks as deleted,
Set add marks values as assigned. Removes hasDraftableAssignment
from collection handlers.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Rewrite `finalizeDraft` and `handleValue`, remove old mechanisms

**Files:**
- Modify: `packages/doura/src/reactivity/draft.ts:224-510` (remove `resolveDraftRefs`, `finalizeDraftValue`, rewrite `handleValue`, rewrite `finalizeDraft`)

This is the core task. Replace the entire finalization logic.

- [ ] **Step 1: Write the new `handleValue` function**

Replace the existing `handleValue` (lines 360-422) with the new version. No `remaining` counter (replaced by child-count early-exit in `finalizeDraft`). No `getOwnPropertyDescriptor` (not needed — `finalizeAssigned` is skipped entirely when no child drafts exist, matching Immer/Mutative behavior).

```ts
/**
 * Recursively resolve draft proxies nested inside non-draft draftable
 * objects (e.g. { bar: draftProxy } assigned via draft.foo = { bar: draft.obj }).
 *
 * Traverses all properties of a draftable object, replacing draft proxies
 * with their finalized base. Uses a Set to prevent infinite recursion on
 * circular references.
 */
function handleValue(target: any, handled: Set<any>): void {
  if (
    target === null ||
    typeof target !== 'object' ||
    handled.has(target) ||
    target[ReactiveFlags.STATE] || // is a draft, skip
    target[ReactiveFlags.SKIP] || // markRaw
    Object.isFrozen(target)
  ) {
    return
  }
  handled.add(target)

  if (isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      const val = target[i]
      if (val !== null && typeof val === 'object') {
        if (val[ReactiveFlags.STATE]) {
          const childState = val[ReactiveFlags.STATE] as DraftState
          target[i] = childState.copy ?? childState.base
        } else {
          handleValue(val, handled)
        }
      }
    }
  } else if (target instanceof Map) {
    target.forEach((val: any, key: any) => {
      if (val !== null && typeof val === 'object') {
        if (val[ReactiveFlags.STATE]) {
          const childState = val[ReactiveFlags.STATE] as DraftState
          target.set(key, childState.copy ?? childState.base)
        } else {
          handleValue(val, handled)
        }
      }
    })
  } else if (target instanceof Set) {
    const replacements: [any, any][] = []
    target.forEach((val: any) => {
      if (val !== null && typeof val === 'object') {
        if (val[ReactiveFlags.STATE]) {
          const childState = val[ReactiveFlags.STATE] as DraftState
          replacements.push([val, childState.copy ?? childState.base])
        } else {
          handleValue(val, handled)
        }
      }
    })
    for (let i = 0; i < replacements.length; i++) {
      target.delete(replacements[i][0])
      target.add(replacements[i][1])
    }
  } else {
    // Plain object — direct property access is safe here because
    // handleValue is only called when child drafts exist (guarded by
    // the childCount > 0 check in finalizeDraft). User-assigned objects
    // with getters but no nested drafts are never reached.
    const keys = Object.keys(target)
    for (let i = 0; i < keys.length; i++) {
      const val = target[keys[i]]
      if (val !== null && typeof val === 'object') {
        if (val[ReactiveFlags.STATE]) {
          const childState = val[ReactiveFlags.STATE] as DraftState
          target[keys[i]] = childState.copy ?? childState.base
        } else {
          handleValue(val, handled)
        }
      }
    }
  }
}
```

- [ ] **Step 2: Write `finalizeAssigned` helper**

Add a new function after `handleValue`:

```ts
/**
 * For each user-assigned key (assignedMap.get(key) === true) in a state's copy,
 * call handleValue to recursively resolve any nested draft proxies.
 */
function finalizeAssigned(state: DraftState, handled: Set<any>): void {
  if (!state.assignedMap) return

  const copy = state.copy ? state.copy : state.base

  if (copy instanceof Set) {
    // Set: iterate assigned values
    state.assignedMap.forEach((assigned, value) => {
      if (assigned) {
        handleValue(value, handled)
      }
    })
    return
  }

  if (copy instanceof Map) {
    state.assignedMap.forEach((assigned, key) => {
      if (assigned) {
        const val = copy.get(key)
        if (val !== null && typeof val === 'object' && !val[ReactiveFlags.STATE]) {
          handleValue(val, handled)
        }
      }
    })
    return
  }

  // Object / Array
  state.assignedMap.forEach((assigned, key) => {
    if (assigned) {
      const val = (copy as any)[key]
      if (val !== null && typeof val === 'object' && !val[ReactiveFlags.STATE]) {
        handleValue(val, handled)
      }
    }
  })
}
```

- [ ] **Step 3: Rewrite `finalizeDraft`**

Replace the existing `finalizeDraft` (lines 432-510) with the new implementation:

```ts
/**
 * Eager finalization: pop flat callbacks (LIFO, leaf-first) to resolve
 * direct child draft proxies, then walk assignedMap entries to resolve
 * nested draft proxies in user-assigned values.
 *
 * This is the fast path for standalone draft()/snapshot() usage.
 * Avoids allocating Maps, DraftSnapshot objects, and snapshot Proxies.
 */
function finalizeDraft(rootDraft: Drafted): any {
  const rootState: DraftState = rootDraft[ReactiveFlags.STATE]
  if (!rootState.modified) {
    return rootState.base
  }

  // Phase 1: Steal copies from all modified states (BFS, then leaf-first reset).
  // This must happen before callbacks run so that child.base is the finalized copy.
  const modified: DraftState[] = [rootState]
  let idx = 0
  while (idx < modified.length) {
    const s = modified[idx++]
    if (s.children) {
      for (let i = 0; i < s.children.length; i++) {
        const child = s.children[i]
        if (child.modified) {
          modified.push(child)
        }
      }
    }
  }
  for (let i = modified.length - 1; i >= 0; i--) {
    stealAndReset(modified[i])
  }

  // Save child-draft count before popping. Equivalent to Mutative's
  // `finalities.revoke.length > 1` check — if no child drafts were
  // ever created, Phase 2 and 3 can be skipped entirely.
  // (Doura doesn't use Proxy.revocable, so finalities.length serves
  // the same purpose: each child draft pushes exactly one callback.)
  const finalities = rootState.root.finalities!
  const childCount = finalities.length

  // Phase 2: Pop finalization callbacks (LIFO = leaf-first).
  // Each callback checks if the child proxy is still at its original key
  // in the parent's copy. If so, replaces it with the finalized base.
  while (finalities.length > 0) {
    finalities.pop()!()
  }

  // Phase 3: Resolve draft proxies nested in user-assigned non-draft values.
  // Only needed when child drafts exist — if only the root was drafted,
  // no draft proxy can possibly be nested in any assigned value.
  // This also avoids entering user-assigned objects that have getters
  // (same optimization as Immer's unfinalizedDrafts_ and Mutative's
  // revoke.length > 1 check).
  if (childCount > 0) {
    const handled = new Set<any>()
    for (let i = 0; i < modified.length; i++) {
      finalizeAssigned(modified[i], handled)
    }
  }

  // Phase 4: Resolve Set draft proxies (lazy-drafted via state.drafts).
  for (let i = 0; i < modified.length; i++) {
    const state = modified[i]
    if (state.type === DraftType.Set) {
      resolveSetDrafts(state as any)
    }
  }

  return rootState.base
}
```

- [ ] **Step 4: Add `resolveSetDrafts` helper for Set finalization**

The old `resolveDraftRefs` had a special Set path that resolved `state.drafts` (lazy-drafted values). We need to preserve this logic:

```ts
/**
 * Resolve Set draft proxies: replace original values with their
 * finalized drafts, and replace direct draft proxies with base values.
 */
function resolveSetDrafts(state: SetDraftState): void {
  const copy = state.copy ?? state.base
  const draftsMap = state.drafts?.size > 0 ? state.drafts : undefined
  if (!draftsMap && !state.children) return

  const values = Array.from(copy)
  let changed = false
  for (let j = 0; j < values.length; j++) {
    const v = values[j]
    // Case 1: original value that was lazily drafted
    if (draftsMap) {
      const drafted = draftsMap.get(v)
      if (drafted) {
        values[j] = (drafted[ReactiveFlags.STATE] as DraftState).base
        changed = true
        continue
      }
    }
    // Case 2: direct draft proxy (e.g. added via Set.add(draftProxy))
    if (v !== null && typeof v === 'object' && v[ReactiveFlags.STATE]) {
      values[j] = (v[ReactiveFlags.STATE] as DraftState).base
      changed = true
    }
  }
  if (changed) {
    copy.clear()
    for (let j = 0; j < values.length; j++) {
      copy.add(values[j])
    }
  }
}
```

- [ ] **Step 5: Remove old functions**

Delete the following functions from `draft.ts`:
- `resolveDraftRefs` (lines 224-331) — replaced by flat callbacks + `finalizeAssigned`
- `finalizeDraftValue` (lines 339-346) — no longer needed, `handleValue` reads `copy ?? base` directly

- [ ] **Step 6: Run tests to verify no regressions**

Run: `pnpm test-unit 2>&1 | tail -5`
Expected: `Tests: 5 skipped, 345 passed, 350 total`

- [ ] **Step 7: Commit**

```bash
git add packages/doura/src/reactivity/draft.ts
git commit -m "refactor: rewrite finalizeDraft with flat callbacks + assignedMap

Replace tree-walk finalization with Mutative's approach:
- Phase 1: steal copies from modified states (leaf-first)
- Phase 2: pop flat finalization callbacks (LIFO)
- Phase 3: resolve nested drafts via assignedMap + handleValue
  (skipped when childCount == 0, matching Mutative's revoke.length > 1)
- Phase 4: resolve Set lazy-drafted values

Remove resolveDraftRefs, finalizeDraftValue, needsScan, childBases,
hasDraftableAssignment, getOwnPropertyDescriptor workaround.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Clean up and verify

**Files:**
- Verify: `packages/doura/src/reactivity/draft.ts`
- Verify: `packages/doura/src/reactivity/baseHandlers.ts`
- Verify: `packages/doura/src/reactivity/collectionHandlers.ts`

- [ ] **Step 1: Grep for any remaining references to removed concepts**

Run: `grep -rn 'hasDraftableAssignment\|resolveDraftRefs\|finalizeDraftValue\|needsScan\|childBases' packages/doura/src/`
Expected: No results (all references should be removed by previous tasks).

If any remain, remove them.

- [ ] **Step 2: Verify no `getOwnPropertyDescriptor` in draft.ts**

Run: `grep -n 'getOwnPropertyDescriptor' packages/doura/src/reactivity/draft.ts`
Expected: No results. The old `handleValue` used it; the new one doesn't need it because the `childCount > 0` guard in `finalizeDraft` prevents entering `handleValue` when there are no child drafts (same as Immer/Mutative).

- [ ] **Step 3: Run full test suite**

Run: `pnpm test 2>&1 | tail -10`
Expected: All tests pass, type-check passes.

- [ ] **Step 4: Run the benchmarks to verify no performance regression**

Run:
```bash
pnpm build doura --types
NODE_ENV=production pnpm ts-node benchmark/suite/object.ts
NODE_ENV=production pnpm ts-node benchmark/suite/object-batch.ts
NODE_ENV=production pnpm ts-node benchmark/suite/array.ts
NODE_ENV=production pnpm ts-node benchmark/suite/array-batch.ts
NODE_ENV=production pnpm ts-node benchmark/suite/set.ts
NODE_ENV=production pnpm ts-node benchmark/suite/map.ts
```

Record baseline numbers. Performance should be equal or better (fewer allocations, no `childBases` Set, no `needsScan` full-scan, no `getOwnPropertyDescriptor` per-property).

- [ ] **Step 5: Commit (only if Step 1 required cleanup)**

```bash
git add -A
git commit -m "refactor: clean up all references to removed finalization mechanisms

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Final integration verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm test 2>&1 | tail -10`
Expected: All 350 tests pass (345 pass + 5 skipped), type-check passes.

- [ ] **Step 2: Run benchmarks and compare to baseline**

Run:
```bash
pnpm build doura --types
NODE_ENV=production pnpm ts-node benchmark/suite/object.ts
NODE_ENV=production pnpm ts-node benchmark/suite/object-batch.ts
NODE_ENV=production pnpm ts-node benchmark/suite/array.ts
NODE_ENV=production pnpm ts-node benchmark/suite/array-batch.ts
NODE_ENV=production pnpm ts-node benchmark/suite/set.ts
NODE_ENV=production pnpm ts-node benchmark/suite/map.ts
```

Compare with baseline from Task 7 Step 4. Performance should be equal or better.

- [ ] **Step 3: Verify specific edge cases pass**

Run: `pnpm test-unit -- --testPathPattern="draft" --testNamePattern="no recursive scan|should not visit" 2>&1`
Expected: Both tests pass.
- `"no recursive scan needed"` — `childCount > 0` is true (one child draft `a`), but `assignedMap` for `'big'` triggers `handleValue(bigData)` which traverses harmlessly (no drafts inside), preserving `nextState.big === bigData` reference identity.
- `"should not visit objects which aren't modified"` — `draft.data = newData` creates `assignedMap.set('data', true)` on root. Root has no child drafts from `newData` itself (it's a plain object). But `void drafted.anObject` creates a child draft, so `childCount > 0`. `finalizeAssigned` runs and calls `handleValue(newData)`. `newData` has a getter `x`. Direct access `newData.x` triggers it → **throws**.

**WAIT** — this test would fail! Let me trace through:
1. `drafted.anObject` → creates child draft → `finalities.length = 1`
2. `drafted.data = newData` → `assignedMap.set('data', true)` on root
3. `finalizeDraft`: `childCount = 1 > 0` → enters Phase 3
4. `finalizeAssigned(rootState)` → `assignedMap.get('data') === true` → `handleValue(newData)`
5. `handleValue` iterates `Object.keys(newData)` = `['x']` → accesses `newData['x']` → **getter throws**

This means we need **one more guard**: only call `handleValue` on a value if it can actually contain draft proxies. A getter-only property cannot hold a draft proxy (it's computed, not stored). The cheapest fix is to keep `getOwnPropertyDescriptor` in `handleValue`'s plain-object branch after all.

BUT — Immer and Mutative also hit this. Immer avoids it via `unfinalizedDrafts_ < 1` which checks **after** finalization callbacks have run (the counter decrements per finalized draft). By the time `handleValue` runs for `newData`, `unfinalizedDrafts_` may already be 0 if all child drafts were resolved by callbacks.

In Doura's case: Phase 2 pops all callbacks, resolving the `anObject` child draft. After Phase 2, there are no more unresolved drafts. If we add a **remaining-unresolved-drafts** counter that decrements in each callback, we can skip `handleValue` entirely when it hits 0.

This is the proper fix. See updated Phase 3 below.

- [ ] **Step 4: Verify deleted concepts are gone**

Run: `grep -rn 'hasDraftableAssignment\|needsScan\|childBases\|finalizeDraftValue\|resolveDraftRefs' packages/doura/src/`
Expected: No results.

---

### Task 9: Add remaining-drafts counter for precise early-exit

**Addresses:** the getter-safety test (`"should not visit objects which aren't modified"`) and the performance test (`"no recursive scan needed"`), without using `getOwnPropertyDescriptor`.

**Files:**
- Modify: `packages/doura/src/reactivity/draft.ts` (finalizeDraft Phase 2/3, handleValue)

The `childCount` check from Task 6 is necessary but not sufficient. It tells us "child drafts were created" but not "child drafts are still unresolved after Phase 2 callbacks". We need a finer counter: how many draft proxies remain embedded in copy trees after the callbacks have run.

- [ ] **Step 1: Add remaining-drafts tracking to `finalizeDraft` and `handleValue`**

In `finalizeDraft`, count how many callbacks actually resolved a draft (replaced proxy with base). Then subtract from `childCount` to get remaining unresolved drafts. Pass this to Phase 3.

Actually, simpler: make each callback return whether it resolved, and count. Or even simpler — use the same pattern as the old `remaining.count`: pass a mutable counter into `handleValue` that decrements on each draft resolution. When it hits 0, `handleValue` returns early.

Updated `handleValue`:

```ts
function handleValue(
  target: any,
  handled: Set<any>,
  remaining: { count: number }
): void {
  if (
    remaining.count <= 0 ||
    target === null ||
    typeof target !== 'object' ||
    handled.has(target) ||
    target[ReactiveFlags.STATE] ||
    target[ReactiveFlags.SKIP] ||
    Object.isFrozen(target)
  ) {
    return
  }
  handled.add(target)

  if (isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      const val = target[i]
      if (val !== null && typeof val === 'object') {
        if (val[ReactiveFlags.STATE]) {
          const childState = val[ReactiveFlags.STATE] as DraftState
          target[i] = childState.copy ?? childState.base
          if (--remaining.count <= 0) return
        } else {
          handleValue(val, handled, remaining)
          if (remaining.count <= 0) return
        }
      }
    }
  } else if (target instanceof Map) {
    target.forEach((val: any, key: any) => {
      if (remaining.count <= 0) return
      if (val !== null && typeof val === 'object') {
        if (val[ReactiveFlags.STATE]) {
          const childState = val[ReactiveFlags.STATE] as DraftState
          target.set(key, childState.copy ?? childState.base)
          remaining.count--
        } else {
          handleValue(val, handled, remaining)
        }
      }
    })
  } else if (target instanceof Set) {
    const replacements: [any, any][] = []
    target.forEach((val: any) => {
      if (remaining.count <= 0) return
      if (val !== null && typeof val === 'object') {
        if (val[ReactiveFlags.STATE]) {
          const childState = val[ReactiveFlags.STATE] as DraftState
          replacements.push([val, childState.copy ?? childState.base])
          remaining.count--
        } else {
          handleValue(val, handled, remaining)
        }
      }
    })
    for (let i = 0; i < replacements.length; i++) {
      target.delete(replacements[i][0])
      target.add(replacements[i][1])
    }
  } else {
    const keys = Object.keys(target)
    for (let i = 0; i < keys.length; i++) {
      const val = target[keys[i]]
      if (val !== null && typeof val === 'object') {
        if (val[ReactiveFlags.STATE]) {
          const childState = val[ReactiveFlags.STATE] as DraftState
          target[keys[i]] = childState.copy ?? childState.base
          if (--remaining.count <= 0) return
        } else {
          handleValue(val, handled, remaining)
          if (remaining.count <= 0) return
        }
      }
    }
  }
}
```

- [ ] **Step 2: Update `finalizeAssigned` to pass remaining counter**

```ts
function finalizeAssigned(
  state: DraftState,
  handled: Set<any>,
  remaining: { count: number }
): void {
  if (!state.assignedMap || remaining.count <= 0) return

  const copy = state.copy ? state.copy : state.base

  if (copy instanceof Set) {
    state.assignedMap.forEach((assigned, value) => {
      if (assigned && remaining.count > 0) {
        handleValue(value, handled, remaining)
      }
    })
    return
  }

  if (copy instanceof Map) {
    state.assignedMap.forEach((assigned, key) => {
      if (assigned && remaining.count > 0) {
        const val = copy.get(key)
        if (val !== null && typeof val === 'object' && !val[ReactiveFlags.STATE]) {
          handleValue(val, handled, remaining)
        }
      }
    })
    return
  }

  // Object / Array
  state.assignedMap.forEach((assigned, key) => {
    if (assigned && remaining.count > 0) {
      const val = (copy as any)[key]
      if (val !== null && typeof val === 'object' && !val[ReactiveFlags.STATE]) {
        handleValue(val, handled, remaining)
      }
    }
  })
}
```

- [ ] **Step 3: Update `finalizeDraft` Phase 3 to compute remaining count**

In `finalizeDraft`, after Phase 2 (popping callbacks), count how many draft proxies were resolved by callbacks. The remaining count = `childCount - resolvedByCallbacks`.

Simpler approach: make each callback increment a counter when it successfully resolves:

```ts
  // Phase 2: Pop finalization callbacks (LIFO = leaf-first).
  const finalities = rootState.root.finalities!
  const childCount = finalities.length
  let resolvedCount = 0
  while (finalities.length > 0) {
    finalities.pop()!()
    // Each callback resolves at most one draft proxy (when the proxy
    // is still at its original key). We can't easily know from here
    // whether it resolved or not. Use childCount as upper bound.
  }
```

Actually, we don't know how many callbacks successfully resolved (vs skipped because the draft was moved). The simplest correct approach: count remaining draft proxies by scanning modified states' copies after Phase 2. But that defeats the purpose.

**Better approach**: just count total child drafts created (`childCount`) and decrement in `handleValue` when a draft is resolved there. Callbacks in Phase 2 also resolve drafts, but we don't track that — we just use `childCount` as the **upper bound**. `handleValue` decrements when it resolves one. When count hits 0, early-exit. This is exactly what the old `remaining.count = Infinity` did, but with a precise initial value.

Wait — the old code used `Infinity`. The problem is we don't know how many drafts the callbacks resolved vs how many remain for `handleValue`. But we CAN know: each callback either resolves one draft (when `copy[key] === childProxy`) or skips (when the draft was moved away). Let's make each callback decrement a shared counter on success:

```ts
  const finalities = rootState.root.finalities!
  const childCount = finalities.length
  const remaining = { count: childCount }

  // Phase 2: Pop finalization callbacks (LIFO = leaf-first).
  // Each callback resolves its draft proxy at the original key position
  // and decrements remaining.count on success.
  while (finalities.length > 0) {
    finalities.pop()!()
  }

  // Phase 3: Resolve draft proxies nested in user-assigned non-draft values.
  // remaining.count tracks how many child drafts are still unresolved.
  // When it hits 0, all drafts are accounted for — skip further scanning.
  if (remaining.count > 0) {
    const handled = new Set<any>()
    for (let i = 0; i < modified.length; i++) {
      finalizeAssigned(modified[i], handled, remaining)
      if (remaining.count <= 0) break
    }
  }
```

And update the callback registration (Task 2/3) to decrement `remaining`:

But wait — callbacks are registered at draft creation time, not at finalization time. They can't capture `remaining` which is created at finalization time.

**Solution**: store `remaining` on root state at the start of finalization, and have callbacks read it from there.

OR: simpler — just don't track in callbacks. Use `childCount` as the remaining count for Phase 3. This over-counts (callbacks already resolved some), but `handleValue` will simply find fewer drafts to resolve and hit 0 faster. The worst case is scanning a few extra properties before early-exit.

This is the approach Immer takes — `unfinalizedDrafts_` is decremented in `markStateFinalized` which is called per-state, not per-callback.

Let's do the simplest correct thing:

```ts
  const finalities = rootState.root.finalities!
  const childCount = finalities.length

  while (finalities.length > 0) {
    finalities.pop()!()
  }

  if (childCount > 0) {
    const handled = new Set<any>()
    const remaining = { count: childCount }
    for (let i = 0; i < modified.length; i++) {
      finalizeAssigned(modified[i], handled, remaining)
      if (remaining.count <= 0) break
    }
  }
```

`remaining` starts at `childCount` (upper bound). `handleValue` decrements each time it resolves a draft proxy inline. In the getter test scenario:
1. `childCount = 1` (one child draft: `anObject`)
2. Phase 2: callback resolves `anObject` in root's copy
3. Phase 3: `remaining = { count: 1 }`. `finalizeAssigned(root)` → `assignedMap.get('data') === true` → `handleValue(newData, handled, remaining)`. `newData` has no draft proxies inside, so `remaining.count` stays at 1. `handleValue` traverses `newData`... and hits the getter.

**This still doesn't work.** The callback resolved the draft, but `remaining.count` doesn't know that.

We need the callbacks to decrement. Since callbacks are closures registered at draft-creation time and `remaining` is created at finalization time, we need to thread `remaining` through. Two options:

**Option A**: Store `remaining` on `rootState` before popping callbacks.

```ts
  const remaining = { count: childCount }
  rootState._remaining = remaining  // temporary field, cleared after finalization

  while (finalities.length > 0) {
    finalities.pop()!()
  }
```

And in the callback (registered in Task 2):

```ts
  state.root.finalities!.push(() => {
    const parentCopy = state.copy ? state.copy : state.base
    if (parentCopy[prop as any] === childProxy) {
      const childState: DraftState = childProxy[ReactiveFlags.STATE]
      parentCopy[prop as any] = childState.base
      // Decrement remaining draft count
      if (state.root._remaining) state.root._remaining.count--
    }
  })
```

This works but adds a temporary field to DraftState.

**Option B**: Don't use callbacks for counting. Instead, after Phase 2, do a quick count of remaining draft proxies in modified states' copies. This is O(children) not O(copy-size).

After Phase 2, iterate `modified` states' children arrays. For each child, check if `child.proxy` still appears somewhere (the callback didn't resolve it). But this is expensive.

**Option C**: Track in the callback, but pass remaining via the finalities array itself — make finalities a typed object instead of a plain array.

**Simplest Option**: Add `_remaining` to `DraftStateBase` as `remaining: { count: number } | null`, null by default. Set it at finalization start. Callbacks read from `root.remaining`. Clean up after.

Actually, we already need to update Task 2/3 callback code. Let's just do Option A.

- [ ] **Step 4: Update `DraftStateBase` — no new field needed, use `finalities` slot**

We can avoid a new field by repurposing: store `remaining` as a well-known property on the finalities array object (arrays are objects). Or, more cleanly, change `finalities` from `Array<() => void>` to a struct:

No — let's keep it simple. Add a field to DraftStateBase:

In Task 1 Step 1, add to the interface:
```ts
  // Mutable counter for finalization: tracks how many child draft proxies
  // remain unresolved. Set at the start of finalizeDraft, decremented by
  // callbacks and handleValue. Null outside finalization.
  finalizeRemaining: { count: number } | null
```

Initialize as `null` in `draft()`.

- [ ] **Step 5: Update callback registration (Task 2/3) to decrement on resolve**

Update the callback in `baseHandlers.ts` (Task 2):

```ts
      state.root.finalities!.push(() => {
        const parentCopy = state.copy ? state.copy : state.base
        if (parentCopy[prop as any] === childProxy) {
          const childState: DraftState = childProxy[ReactiveFlags.STATE]
          parentCopy[prop as any] = childState.base
          state.root.finalizeRemaining!.count--
        }
      })
```

Same for Map callback in `collectionHandlers.ts` (Task 3):

```ts
      state.root.finalities!.push(() => {
        const parentCopy = state.copy ? state.copy : state.base
        if (parentCopy.get(key) === childProxy) {
          const childState: DraftState = childProxy[ReactiveFlags.STATE]
          parentCopy.set(key, childState.base)
          state.root.finalizeRemaining!.count--
        }
      })
```

- [ ] **Step 6: Update `finalizeDraft` Phase 2/3 to use `finalizeRemaining`**

```ts
  const finalities = rootState.root.finalities!
  const childCount = finalities.length

  // Set remaining counter before popping — callbacks will decrement it.
  const remaining = { count: childCount }
  rootState.root.finalizeRemaining = remaining

  // Phase 2
  while (finalities.length > 0) {
    finalities.pop()!()
  }

  // Phase 3 — remaining.count now reflects truly unresolved drafts.
  if (remaining.count > 0) {
    const handled = new Set<any>()
    for (let i = 0; i < modified.length; i++) {
      finalizeAssigned(modified[i], handled, remaining)
      if (remaining.count <= 0) break
    }
  }

  rootState.root.finalizeRemaining = null
```

- [ ] **Step 7: Run tests, especially the getter-safety and no-recursive-scan tests**

Run: `pnpm test-unit -- --testPathPattern="draft" --testNamePattern="should not visit|no recursive scan" 2>&1`
Expected: Both pass.

Trace for `"should not visit"`:
1. `drafted.anObject` → child draft created → `finalities.length = 1`
2. `drafted.data = newData` → `assignedMap.set('data', true)`
3. `finalizeDraft`: `childCount = 1`, `remaining = { count: 1 }`
4. Phase 2: callback resolves `anObject` → `remaining.count = 0`
5. Phase 3: `remaining.count === 0` → skipped entirely → `newData` never entered → getter not triggered ✓

Trace for `"no recursive scan needed"`:
1. `draft.a.x = 2` → child draft `a` created → `finalities.length = 1`
2. `draft.big = bigData` → `assignedMap.set('big', true)`
3. Phase 2: callback resolves `a` → `remaining.count = 0`
4. Phase 3: skipped → `bigData` never traversed ✓

- [ ] **Step 8: Run full test suite**

Run: `pnpm test-unit 2>&1 | tail -5`
Expected: `Tests: 5 skipped, 345 passed, 350 total`

- [ ] **Step 9: Commit**

```bash
git add packages/doura/src/reactivity/draft.ts packages/doura/src/reactivity/baseHandlers.ts packages/doura/src/reactivity/collectionHandlers.ts
git commit -m "perf: add finalizeRemaining counter for precise early-exit

Callbacks decrement remaining count when they resolve a draft proxy.
Phase 3 (handleValue scan) is skipped entirely when all drafts are
already resolved — avoids entering user-assigned objects with getters
and avoids traversing large plain data trees.

Equivalent to Immer's unfinalizedDrafts_ / Mutative's revoke.length.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
