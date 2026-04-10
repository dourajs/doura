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
  // listener
  listeners: Array<() => void>
  // child drafts reachable from this state's copy, with reference counts.
  children: Map<DraftState, number>
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
  // BFS: clear all children but keep root's own copy intact
  // (root copy holds the just-assigned new value)
  const queue: DraftState[] = [...root.children.keys()]
  root.children = new Map()
  while (queue.length) {
    const s = queue.pop()!
    for (const [c] of s.children) {
      queue.push(c)
    }
    s.children = new Map()
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
    listeners: [],
    children: new Map(),
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
    Object.keys(state).forEach((key) => {
      Object.defineProperty(proxyTarget, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: (state as any)[key],
      })
    })
  }

  const proxy = new Proxy(proxyTarget, proxyHandlers)
  proxyTarget.proxy = proxy
  if (parent) {
    proxyTarget.root = parent.root
    parent.children.set(
      proxyTarget,
      (parent.children.get(proxyTarget) || 0) + 1
    )
  } else {
    proxyTarget.root = proxyTarget
  }

  draftMap.set(proxyTarget, proxy)

  return proxyTarget.proxy as any
}

export function watch(draft: any, cb: () => void): () => void {
  const state: DraftState = draft[ReactiveFlags.STATE]
  if (state.disposed) {
    return NOOP
  }

  state.listeners.push(cb)

  return () => {
    const index = state.listeners.indexOf(cb)
    if (index >= 0) {
      state.listeners.splice(index, 1)
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
    const value = shallowCopy(state.copy)
    updateDraftState(state, value)
    snapshots_.delete(state.proxy)
    copies.set(state, value)
    for (const [c] of state.children) {
      queue.push(c)
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
  parent.children.set(child, (parent.children.get(child) || 0) + 1)
}

export function removeChildRef(parent: DraftState, child: DraftState) {
  const count = parent.children.get(child)
  if (count !== undefined) {
    if (count <= 1) {
      parent.children.delete(child)
    } else {
      parent.children.set(child, count - 1)
    }
  }
}

function updateDraftState(state: DraftState, base: AnyObject) {
  state.modified = false
  state.base = base
}
