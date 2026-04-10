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
  key: PropertyKey | undefined
  // The base object.
  base: T
  // The base proxy, draft itself.
  proxy: T
  // The base copy with any updated values.
  copy: T | null
  // True for both shallow and deep changes.
  modified: boolean
  // Ture after being disposed
  disposed: boolean
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

let uid = 0
export function draft<T extends Objectish>(
  target: T & Target,
  parent?: DraftState,
  key?: PropertyKey
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
    key: key,
    base: target,
    proxy: null as any, // set below
    copy: null,
    modified: false,
    disposed: false,
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
 * Resolve draft proxy references in a stolen copy.
 * Uses children's stored keys for O(1) lookup per child.
 * Falls back to a full scan when a child was moved or deleted.
 * Handles plain objects, arrays, Sets, and Maps.
 */
function resolveDraftRefs(state: DraftState, copy: any) {
  if (!state.children) return

  // Set: copy still holds original refs; state.drafts maps original → draft.
  // Replace originals that were drafted with their resolved base values.
  if (copy instanceof Set) {
    const setState = state as any
    if (setState.drafts && setState.drafts.size > 0) {
      const replacements: [any, any][] = []
      setState.drafts.forEach((drafted: any, original: any) => {
        const childState: DraftState = drafted[ReactiveFlags.STATE]
        replacements.push([original, childState.base])
      })
      for (let j = 0; j < replacements.length; j++) {
        copy.delete(replacements[j][0])
        copy.add(replacements[j][1])
      }
    }
    return
  }

  // Map: replace draft proxy values with resolved base values
  if (copy instanceof Map) {
    copy.forEach((val: any, key: any) => {
      if (val !== null && typeof val === 'object' && val[ReactiveFlags.STATE]) {
        copy.set(key, (val[ReactiveFlags.STATE] as DraftState).base)
      }
    })
    return
  }

  // Object / Array
  const children = state.children
  let needsScan = false

  for (let j = 0; j < children.length; j++) {
    const child = children[j]
    const key = child.key
    if (key !== undefined && copy[key as any] === child.proxy) {
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

  // Process leaf-first: steal copies and resolve draft refs.
  for (let i = modified.length - 1; i >= 0; i--) {
    const state = modified[i]
    const copy = stealAndReset(state)
    resolveDraftRefs(state, copy)
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
