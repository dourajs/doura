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
  // Flat finalization callbacks (root only).
  // Every child draft pushes a callback at creation time.
  // Popped LIFO during finalizeDraft for leaf-first resolution.
  finalities: Array<() => void> | null
  // Tracks which keys were user-assigned (true) or deleted (false).
  // Lazily created on first set/delete. Used by finalization to know
  // which keys need handleValue scanning.
  assignedMap: Map<any, boolean> | null
  // Mutable counter for finalization (root only): tracks how many child
  // draft proxies remain unresolved. Set at the start of finalizeDraft,
  // decremented by callbacks and handleValue. Null outside finalization.
  finalizeRemaining: { count: number } | null
  // @deprecated — to be removed when finalizeDraft is rewritten (Task 6).
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
    finalities: null, // set on root below
    assignedMap: null, // lazy, created on first set/delete
    finalizeRemaining: null, // set during finalization
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
    proxyTarget.finalities = [] // root owns the flat callback array
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
 * Resolve draft proxy references in a stolen copy.
 * Uses children's stored keys for O(1) lookup per child.
 * Falls back to a full scan when a child was moved or deleted.
 * Handles plain objects, arrays, Sets, and Maps.
 */
function resolveDraftRefs(state: DraftState, copy: any) {
  if (!state.children) return

  // Set: copy may contain original refs (lazy-drafted via state.drafts)
  // and/or direct draft proxies (added via Set.add(draftProxy)).
  // Rebuild the Set to preserve insertion order while resolving both.
  if (copy instanceof Set) {
    const setState = state as any
    const draftsMap: Map<any, any> | undefined =
      setState.drafts?.size > 0 ? setState.drafts : undefined
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
    return
  }

  // Map: replace draft proxy values with resolved base values.
  // Try key-based O(1) resolution first; fall back to full scan
  // when a draft was moved to a different key (delete + set).
  if (copy instanceof Map) {
    const ch = state.children!
    let needsScan = false
    for (let j = 0; j < ch.length; j++) {
      const child = ch[j]
      const key = child.key
      if (key !== NO_KEY && copy.get(key) === child.proxy) {
        copy.set(key, child.base)
      } else {
        needsScan = true
      }
    }
    if (needsScan) {
      copy.forEach((val: any, key: any) => {
        if (
          val !== null &&
          typeof val === 'object' &&
          val[ReactiveFlags.STATE]
        ) {
          copy.set(key, (val[ReactiveFlags.STATE] as DraftState).base)
        }
      })
    }
    return
  }

  // Object / Array
  const children = state.children
  let needsScan = false

  for (let j = 0; j < children.length; j++) {
    const child = children[j]
    const key = child.key
    if (key !== NO_KEY && copy[key as any] === child.proxy) {
      copy[key as any] = child.base
    } else {
      needsScan = true
    }
  }

  if (needsScan) {
    if (isArray(copy)) {
      for (let j = 0; j < copy.length; j++) {
        const val = copy[j]
        if (
          val !== null &&
          typeof val === 'object' &&
          val[ReactiveFlags.STATE]
        ) {
          copy[j] = (val[ReactiveFlags.STATE] as DraftState).base
        }
      }
    } else {
      const keys = Object.keys(copy)
      for (let j = 0; j < keys.length; j++) {
        const val = copy[keys[j]]
        if (
          val !== null &&
          typeof val === 'object' &&
          val[ReactiveFlags.STATE]
        ) {
          copy[keys[j]] = (val[ReactiveFlags.STATE] as DraftState).base
        }
      }
    }
  }
}

/**
 * Resolve a single draft proxy found by handleValue: ensure its copy
 * is stolen (if modified) and return the finalized base value.
 * Handles drafts that were disconnected from the tree (e.g. deleted
 * from parent then nested in a new plain object).
 */
function finalizeDraftValue(state: DraftState): any {
  if (state.modified && state.copy) {
    // This draft was modified but not yet finalized by the main loop
    // (disconnected from the tree). Steal its copy now.
    stealAndReset(state)
  }
  return state.base
}

/**
 * Recursively resolve draft proxies nested inside non-draft draftable
 * objects (e.g. { bar: draftProxy } assigned via draft.foo = { bar: draft.obj }).
 *
 * Similar to Mutative's handleValue: traverses all properties of a
 * draftable object, replacing draft proxies with their finalized base.
 * Uses a Set to prevent infinite recursion on circular references.
 *
 * Early termination (Immer-style): tracks remaining unresolved drafts.
 * When the count reaches 0, all drafts are resolved and further
 * recursion is skipped — avoids traversing large assigned data trees.
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
    target[ReactiveFlags.STATE] || // is a draft, skip (shouldn't happen)
    target[ReactiveFlags.SKIP] // markRaw
  ) {
    return
  }
  handled.add(target)

  // Helper: process a single value — resolve draft or recurse into draftable
  const processVal = (val: any, setter: (resolved: any) => void): void => {
    if (val === null || typeof val !== 'object') return
    if (val[ReactiveFlags.STATE]) {
      setter(finalizeDraftValue(val[ReactiveFlags.STATE] as DraftState))
      remaining.count--
    } else if (remaining.count > 0) {
      handleValue(val, handled, remaining)
    }
  }

  if (isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      processVal(target[i], (v) => {
        target[i] = v
      })
      if (remaining.count <= 0) return
    }
  } else if (target instanceof Map) {
    target.forEach((val: any, key: any) => {
      processVal(val, (v) => target.set(key, v))
    })
  } else if (target instanceof Set) {
    const replacements: [any, any][] = []
    target.forEach((val: any) => {
      processVal(val, (v) => replacements.push([val, v]))
    })
    for (let i = 0; i < replacements.length; i++) {
      target.delete(replacements[i][0])
      target.add(replacements[i][1])
    }
  } else {
    // Plain object — use getOwnPropertyDescriptor to avoid
    // triggering getters (which may throw or have side effects).
    const keys = Object.keys(target)
    for (let i = 0; i < keys.length; i++) {
      const desc = Object.getOwnPropertyDescriptor(target, keys[i])
      if (desc && 'value' in desc) {
        processVal(desc.value, (v) => {
          target[keys[i]] = v
        })
        if (remaining.count <= 0) return
      }
    }
  }
}

/**
 * Eager finalization: walk modified states, steal copies, and resolve
 * all draft proxy references in-place. Returns a plain (non-Proxy)
 * object with structural sharing for unmodified subtrees.
 *
 * This is the fast path for standalone draft()/snapshot() usage.
 * Avoids allocating Maps, DraftSnapshot objects, and snapshot Proxies.
 */
function finalizeDraft(rootDraft: Drafted): any {
  const rootState: DraftState = rootDraft[ReactiveFlags.STATE]
  if (!rootState.modified) {
    return rootState.base
  }

  // Collect modified states via BFS, then process in reverse (leaf-first).
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

  // Process leaf-first: steal copies and resolve direct draft refs.
  for (let i = modified.length - 1; i >= 0; i--) {
    const state = modified[i]
    const copy = stealAndReset(state)
    resolveDraftRefs(state, copy)
  }

  // If a draftable non-draft value was assigned (e.g. draft.foo = { bar: draftProxy }),
  // recursively scan each modified state's copy for nested draft proxies.
  // Only scan values that differ from the original base (user-assigned values).
  // Early termination: skip entirely if no such assignments were made.
  if (rootState.root.hasDraftableAssignment) {
    const handled = new Set<any>()
    const remaining = { count: Infinity }
    for (let i = modified.length - 1; i >= 0; i--) {
      const state = modified[i]
      const copy = state.base // after stealAndReset, base IS the copy
      // Build set of known child bases to skip (they are already resolved
      // or are original values that can't contain draft proxies).
      const childBases = new Set<any>()
      if (state.children) {
        for (let j = 0; j < state.children.length; j++) {
          childBases.add(state.children[j].base)
        }
      }
      const scanVal = (val: any) => {
        if (
          val !== null &&
          typeof val === 'object' &&
          !childBases.has(val) &&
          !val[ReactiveFlags.STATE]
        ) {
          handleValue(val, handled, remaining)
        }
      }
      if (copy instanceof Map) {
        copy.forEach((val: any) => scanVal(val))
      } else if (!(copy instanceof Set)) {
        // Object or Array
        if (isArray(copy)) {
          for (let j = 0; j < copy.length; j++) {
            scanVal(copy[j])
          }
        } else {
          const keys = Object.keys(copy)
          for (let j = 0; j < keys.length; j++) {
            const desc = Object.getOwnPropertyDescriptor(copy, keys[j])
            if (desc && 'value' in desc) {
              scanVal(desc.value)
            }
          }
        }
      }
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
  // Only traverse modified states. markChanged() bubbles up from leaf to
  // root, so an unmodified state cannot have modified descendants.
  // Unmodified drafts are resolved lazily by snapshotHandler's toSnapshot.
  const queue = [draft[ReactiveFlags.STATE]]
  while (queue.length) {
    const state = queue.pop()!
    if (!state.modified) {
      continue
    }
    const value = stealAndReset(state)
    snapshots_.delete(state.proxy)
    copies.set(state, value)
    if (state.children) {
      for (let i = 0; i < state.children.length; i++) {
        queue.push(state.children[i])
      }
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

// updateDraftState is no longer needed - takeSnapshotFromDraft steals the copy
// directly instead of making a new shallow copy.
