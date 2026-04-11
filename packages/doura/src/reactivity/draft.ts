import {
  Target,
  TargetType,
  ReactiveFlags,
  isDraft,
  Drafted,
  getTargetType,
} from './common'
import { mutableHandlers } from './baseHandlers'
import { mutableCollectionHandlers } from './collectionHandlers'
import { DraftSnapshot, snapshotHandler } from './snapshotHandler'
import { NOOP, isObject, isArray, shallowCopy } from '../utils'
import { AnyObject, Objectish, AnySet, AnyMap } from '../types'

export type PatchPath = (string | number)[]

/** @deprecated kept for backward compatibility - use state.proxy directly */
export const draftMap = new WeakMap<any, any>()

export const enum DraftType {
  Object,
  Map,
  Set,
}

interface DraftStateBase<T extends AnyObject = AnyObject> {
  id: number
  // The root state.
  root: DraftState
  // The parent state.
  parent?: DraftState
  // The key in the parent's copy that holds this draft's proxy.
  // Used during finalization to eagerly replace draft refs with resolved values.
  // For objects/arrays: PropertyKey. For Map entries: any Map key type.
  key: any
  // The base object.
  base: T
  // The base proxy, draft itself.
  proxy: T
  // The base copy with any updated values.
  copy: T | null
  // True for both shallow and deep changes.
  modified: boolean
  // True after being disposed
  disposed: boolean
  // Tracks which keys were user-assigned (true) or deleted (false).
  // Lazily created on first set/delete. Used by finalization to know
  // which keys need handleValue scanning.
  assignedMap: Map<any, boolean> | null
  // Set on root when a draftable non-draft value is assigned to a
  // draft property (e.g. draft.foo = { bar: draftProxy }). Signals
  // that handleValue must recurse into assigned values during finalization.
  hasDraftableAssignment?: boolean
  // listener (lazy: only allocated when watch() is called)
  listeners: Array<() => void> | null
  // Child draft states reachable from this state's copy.
  // Simple array for fast push — stale entries (from overwritten properties)
  // are harmless because BFS skips them via the modified=false check.
  // (lazy: only allocated when first child is added)
  children: DraftState[] | null
}

export interface ObjectDraftState extends DraftStateBase<AnyObject> {
  type: DraftType.Object
}

export interface MapDraftState extends DraftStateBase<AnyMap> {
  type: DraftType.Map
}

export interface SetDraftState extends DraftStateBase<AnySet> {
  type: DraftType.Set
  drafts: Map<any, Drafted> // maps the original value to the draft value in the new set
}

export type DraftState = ObjectDraftState | MapDraftState | SetDraftState

export function disposeDraft(draft: Drafted) {
  const state: DraftState = draft[ReactiveFlags.STATE]
  state.disposed = true
}

/**
 * Discard orphaned child drafts from the draft tree.
 * Clears children arrays and resets copy on all descendant states,
 * so the next property access rebuilds from the current base/copy.
 * Used after replace() to prevent accumulation from previous state trees.
 */
export function resetDraftChildren(draft: Drafted) {
  const root: DraftState = draft[ReactiveFlags.STATE]
  if (!root.children) return
  // BFS: clear all children but keep root's own copy intact
  // (root copy holds the just-assigned new value)
  const queue: DraftState[] = root.children.slice()
  root.children = null
  while (queue.length) {
    const s = queue.pop()!
    if (s.children) {
      for (let i = 0; i < s.children.length; i++) {
        queue.push(s.children[i])
      }
      s.children = null
    }
    s.copy = null
  }
}

// Sentinel for "no key set" — distinguishes from undefined which
// is a valid Map key.
const NO_KEY = Symbol.for('__doura_no_key')

let uid = 0
export function draft<T extends Objectish>(
  target: T & Target,
  parent?: DraftState,
  key?: any
): T & Drafted {
  // only specific value types can be observed.
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target as any
  }

  if (target[ReactiveFlags.SKIP] || !Object.isExtensible(target)) {
    return target as any
  }

  // target is already a Draft, return it.
  if (target[ReactiveFlags.STATE]) {
    return target as any
  }

  let state: DraftState = {
    type: DraftType.Object,
    id: uid++,
    root: null as any, // set below
    parent: parent,
    key: arguments.length >= 3 ? key : NO_KEY,
    base: target,
    proxy: null as any, // set below
    copy: null,
    modified: false,
    disposed: false,
    assignedMap: null, // lazy, created on first set/delete
    listeners: null,
    children: null,
  }
  let proxyTarget: DraftState = state
  let proxyHandlers: ProxyHandler<any> = mutableHandlers

  if (targetType === TargetType.SET) {
    state = state as any as SetDraftState
    state.type = DraftType.Set
    state.drafts = new Map()
    proxyTarget = new Set() as any as DraftState
    proxyHandlers = mutableCollectionHandlers
  } else if (targetType === TargetType.MAP) {
    state = state as any as MapDraftState
    state.type = DraftType.Map
    proxyTarget = new Map() as any as DraftState
    proxyHandlers = mutableCollectionHandlers
  } else if (targetType === TargetType.ARRAY) {
    // in order to pass the check of "obj instanceof Array"
    proxyTarget = [] as any as DraftState
  }

  if (proxyTarget !== state) {
    // Object.assign is significantly faster than Object.defineProperty loop
    // (same approach as Mutative)
    Object.assign(proxyTarget, state)
  }

  const proxy = new Proxy(proxyTarget, proxyHandlers)
  proxyTarget.proxy = proxy
  if (parent) {
    proxyTarget.root = parent.root
    addChildRef(parent, proxyTarget)
  } else {
    proxyTarget.root = proxyTarget
  }

  return proxyTarget.proxy as any
}

export function watch(draft: any, cb: () => void): () => void {
  const state: DraftState = draft[ReactiveFlags.STATE]
  if (state.disposed) {
    return NOOP
  }

  if (!state.listeners) {
    state.listeners = []
  }
  state.listeners.push(cb)

  return () => {
    const listeners = state.listeners
    if (listeners) {
      const index = listeners.indexOf(cb)
      if (index >= 0) {
        listeners.splice(index, 1)
      }
    }
  }
}

/**
 * Steal copies from modified draft states and reset them.
 * Common helper used by both snapshot paths.
 * Processes states bottom-up (children before parents in the queue)
 * so that when we resolve draft refs in a parent's copy, child copies
 * are already finalized.
 */
function stealAndReset(state: DraftState): any {
  // Steal copy or shallow-copy base (when modified via bubble-up only)
  const value = state.copy ? state.copy : shallowCopy(state.base)
  state.base = value as any
  state.copy = null
  state.modified = false
  return value
}

/**
 * Recursively resolve draft proxies nested inside non-draft draftable
 * objects (e.g. { bar: draftProxy } assigned via draft.foo = { bar: draft.obj }).
 *
 * Traverses all properties of a draftable object, replacing draft proxies
 * with their finalized base. Uses a Set to prevent infinite recursion on
 * circular references. Early-exits when remaining.count hits 0.
 */
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

  // Helper: resolve a draft proxy and recurse into the resolved value.
  // The resolved value (copy ?? base) may itself contain nested draft
  // proxies (e.g. in slow path where callbacks don't pre-resolve layers).
  const resolve = (childState: DraftState): any => {
    const resolved = childState.copy ?? childState.base
    if (typeof resolved === 'object' && resolved !== null) {
      handleValue(resolved, handled, remaining)
    }
    return resolved
  }

  if (isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      const val = target[i]
      if (val !== null && typeof val === 'object') {
        if (val[ReactiveFlags.STATE]) {
          target[i] = resolve(val[ReactiveFlags.STATE] as DraftState)
          if (remaining.count <= 0) return
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
          target.set(key, resolve(val[ReactiveFlags.STATE] as DraftState))
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
          replacements.push([
            val,
            resolve(val[ReactiveFlags.STATE] as DraftState),
          ])
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
    // Plain object — use getOwnPropertyDescriptor to avoid triggering
    // getters (which may throw or have side effects). User-assigned
    // objects may have accessor properties that aren't data values.
    const keys = Object.keys(target)
    for (let i = 0; i < keys.length; i++) {
      const desc = Object.getOwnPropertyDescriptor(target, keys[i])
      if (desc && 'value' in desc) {
        const val = desc.value
        if (val !== null && typeof val === 'object') {
          if (val[ReactiveFlags.STATE]) {
            target[keys[i]] = resolve(val[ReactiveFlags.STATE] as DraftState)
            if (remaining.count <= 0) return
          } else {
            handleValue(val, handled, remaining)
            if (remaining.count <= 0) return
          }
        }
      }
    }
  }
}

/**
 * For each user-assigned key (assignedMap.get(key) === true) in a state's
 * copy, resolve draft proxies directly and recurse into non-draft objects
 * via handleValue. Direct draft resolution always runs (a draft proxy at
 * an assigned key must always be replaced). handleValue recursion is
 * gated by scanNonDrafts (skip when no draftable non-draft values were
 * assigned — equivalent to the old hasDraftableAssignment flag).
 */
function finalizeAssigned(
  state: DraftState,
  handled: Set<any>,
  scanNonDrafts: boolean
): void {
  if (!state.assignedMap) return

  const copy = state.copy ? state.copy : state.base

  // Helper: resolve a single assigned value.
  const resolveVal = (val: any, setter: (resolved: any) => void): void => {
    if (val === null || typeof val !== 'object') return
    if (val[ReactiveFlags.STATE]) {
      // Draft proxy at an assigned key (e.g. moved via s.foo = s.obj)
      const childState = val[ReactiveFlags.STATE] as DraftState
      setter(childState.copy ?? childState.base)
    } else if (scanNonDrafts) {
      // Recurse into non-draft objects only when hasDraftableAssignment is set
      handleValue(val, handled, { count: Infinity })
    }
  }

  if (copy instanceof Set) {
    state.assignedMap.forEach((assigned, value) => {
      if (assigned) {
        resolveVal(value, (v) => {
          copy.delete(value)
          copy.add(v)
        })
      }
    })
    return
  }

  if (copy instanceof Map) {
    state.assignedMap.forEach((assigned, key) => {
      if (assigned) {
        resolveVal(copy.get(key), (v) => copy.set(key, v))
      }
    })
    return
  }

  // Object / Array
  state.assignedMap.forEach((assigned, key) => {
    if (assigned) {
      resolveVal((copy as any)[key], (v) => {
        ;(copy as any)[key] = v
      })
    }
  })
}

/**
 * Slow-path variant of finalizeAssigned: only recurses into non-draft
 * draftable values via handleValue. Direct draft proxies at assigned
 * keys are left for toSnapshot to resolve lazily (preserving DraftState
 * identity for view reactivity). Handles both same-root orphans and
 * cross-root foreign drafts since handleValue reads
 * childState.copy ?? childState.base directly.
 */
function finalizeAssignedForSnapshot(
  state: DraftState,
  handled: Set<any>
): void {
  if (!state.assignedMap) return

  const copy = state.copy ? state.copy : state.base

  // Helper: resolve nested draft proxies within an assigned value.
  // If the value is a draft proxy, enter its base/copy to find nested drafts.
  // If the value is a plain draftable object, enter it directly.
  // Direct draft proxies are NOT replaced (left for toSnapshot lazy resolution).
  const scanValue = (val: any) => {
    if (val === null || typeof val !== 'object') return
    if (val[ReactiveFlags.STATE]) {
      // Draft proxy at assigned key — don't replace it, but scan its
      // underlying value for nested drafts (e.g. wrapper draft created
      // by spread `{ ...drafted }` whose base contains orphan draft proxies).
      const s = val[ReactiveFlags.STATE] as DraftState
      const underlying = s.copy ?? s.base
      handleValue(underlying, handled, { count: Infinity })
    } else {
      handleValue(val, handled, { count: Infinity })
    }
  }

  if (copy instanceof Map) {
    state.assignedMap.forEach((assigned, key) => {
      if (assigned) scanValue(copy.get(key))
    })
    return
  }

  if (!(copy instanceof Set)) {
    state.assignedMap.forEach((assigned, key) => {
      if (assigned) scanValue((copy as any)[key])
    })
  }
}

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

/**
 * Eager finalization: collect modified states via BFS, then process
 * leaf-first in a single reverse pass — steal, resolve children,
 * resolve assigned keys, and handle Sets.
 *
 * This is the fast path for standalone draft()/snapshot() usage.
 * Avoids allocating Maps, DraftSnapshot objects, and snapshot Proxies.
 */
function finalizeDraft(rootDraft: Drafted): any {
  const rootState: DraftState = rootDraft[ReactiveFlags.STATE]
  if (!rootState.modified) {
    return rootState.base
  }

  // BFS: collect all modified states. markChanged() bubbles up from leaf
  // to root, so an unmodified state cannot have modified descendants.
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

  // Single reverse pass (leaf-first): steal + resolve children +
  // resolve assigned keys + resolve Sets. Leaf-first order ensures
  // child.base is fully resolved before the parent reads it.
  const scanNonDrafts = !!rootState.root.hasDraftableAssignment
  const handled = new Set<any>()
  for (let i = modified.length - 1; i >= 0; i--) {
    const s = modified[i]

    // Steal copy (or shallow-copy base for bubble-up-only states).
    stealAndReset(s)
    const parentCopy = s.base // after stealAndReset, base IS the stolen copy

    // Resolve child draft proxies at their creation-time keys.
    // state.key is immutable (never updated by set trap), so it always
    // points to the original position where the child was created.
    if (s.children) {
      if (parentCopy instanceof Map) {
        for (let j = 0; j < s.children.length; j++) {
          const child = s.children[j]
          if (
            child.key !== NO_KEY &&
            parentCopy.get(child.key) === child.proxy
          ) {
            parentCopy.set(child.key, child.base)
          }
        }
      } else if (!(parentCopy instanceof Set)) {
        for (let j = 0; j < s.children.length; j++) {
          const child = s.children[j]
          if (
            child.key !== NO_KEY &&
            parentCopy[child.key as any] === child.proxy
          ) {
            parentCopy[child.key as any] = child.base
          }
        }
      }
    }

    // Resolve draft proxies at user-assigned keys + nested in plain objects.
    finalizeAssigned(s, handled, scanNonDrafts)

    // Resolve Set draft proxies (lazy-drafted via state.drafts).
    if (s.type === DraftType.Set) {
      resolveSetDrafts(s as any)
    }
  }

  return rootState.base
}

export function takeSnapshotFromDraft(
  draft: Drafted,
  snapshots?: Map<any, any>
): DraftSnapshot {
  const copies = new Map()
  const draftSnapshot: DraftSnapshot = {
    copies,
    snapshots: snapshots || new Map(),
  }
  const snapshots_ = draftSnapshot.snapshots

  // Steal copies from modified states via BFS through children.
  // Orphaned drafts (removed from children via delete) are NOT stolen
  // here — they are resolved by finalizeAssignedForSnapshot below,
  // which reads their live copy/base via handleValue.
  const modified: DraftState[] = []
  const queue = [draft[ReactiveFlags.STATE]]
  while (queue.length) {
    const state = queue.pop()!
    if (!state.modified) {
      continue
    }
    const value = stealAndReset(state)
    snapshots_.delete(state.proxy)
    copies.set(state, value)
    modified.push(state)
    if (state.children) {
      for (let i = 0; i < state.children.length; i++) {
        queue.push(state.children[i])
      }
    }
  }

  // Resolve draft proxies nested in user-assigned non-draft objects.
  // Scans assignedMap entries via handleValue, which reads
  // childState.copy ?? childState.base — handles orphans (not stolen
  // above) and cross-root foreign drafts without needing a flat list.
  // Direct draft proxies at assigned keys are left for toSnapshot to
  // resolve lazily (preserving DraftState identity for view reactivity).
  if (draft[ReactiveFlags.STATE].root.hasDraftableAssignment) {
    const handled = new Set<any>()
    for (let i = 0; i < modified.length; i++) {
      finalizeAssignedForSnapshot(modified[i], handled)
    }
  }

  return draftSnapshot
}

export function createSnapshotProxy(obj: any, draftSnapshot: DraftSnapshot) {
  if (isDraft(obj)) {
    const state: DraftState = obj[ReactiveFlags.STATE]
    // Use copies entry for modified states, fall back to base for unmodified
    const target = draftSnapshot.copies.get(state) || state.base
    const handler = snapshotHandler(target, draftSnapshot)
    return new Proxy(target, handler)
  }

  const handler = snapshotHandler(obj, draftSnapshot)
  return new Proxy(obj, handler)
}

export function snapshot<T>(
  value: T,
  draft: Drafted,
  snapshots?: Map<any, any>
): T {
  if (!isObject(value)) {
    return value
  }

  // Fast path: when no external snapshots cache is provided (standalone usage),
  // use eager finalization that avoids Map/Proxy allocations entirely.
  if (!snapshots && isDraft(value) && (value as any) === (draft as any)) {
    return finalizeDraft(draft) as T
  }

  // Slow path: model system with structural sharing via snapshots map.
  const draftSnapshot = takeSnapshotFromDraft(draft, snapshots)
  return createSnapshotProxy(value, draftSnapshot)
}

export function addChildRef(parent: DraftState, child: DraftState) {
  if (!parent.children) {
    parent.children = []
  }
  parent.children.push(child)
}

export function removeChildRef(parent: DraftState, child: DraftState) {
  if (!parent.children) return
  // Array duplicates serve as the refcount: each addChildRef pushes one
  // entry, each removeChildRef removes one. indexOf + splice is O(n)
  // but removal is rare (only on delete/overwrite of draft-valued props).
  const idx = parent.children.indexOf(child)
  if (idx !== -1) {
    parent.children.splice(idx, 1)
  }
}
