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
import { NOOP, isObject, shallowCopy } from '../utils'
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
  parent?: DraftState
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
    // Steal the copy directly instead of shallow-copying it again.
    // The copy is already a shallow clone of base (created by prepareCopy).
    // We hand it to the snapshot and reset the draft: set base to the
    // stolen copy so future mutations start from the correct state,
    // and null out copy so the next mutation triggers a fresh prepareCopy.
    // This is the same "steal the copy" approach Immer and Mutative use.
    //
    // When copy is null, this state was marked modified via markChanged
    // bubble-up from a child, but prepareCopy was never called because
    // the state itself was never directly written. In this case, base
    // already reflects the current state (children are draft proxies
    // reachable from base), so we create the snapshot copy from base.
    const value = state.copy ? state.copy : shallowCopy(state.base)
    state.base = value as any
    state.copy = null
    state.modified = false
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
