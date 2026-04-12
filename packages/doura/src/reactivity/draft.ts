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
import { NOOP, isObject, isArray, shallowCopy } from '../utils'
import { AnyObject, Objectish, AnySet, AnyMap } from '../types'

export type PatchPath = (string | number)[]

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
  // Monotonically increasing counter on the root state, incremented on
  // every mutation (in trigger()). Used by model views to detect whether
  // the state tree changed since the last snapshot, replacing the
  // mightChange/trackDraft/triggerDraft subsystem.
  version: number
  // Child draft states reachable from this state's copy.
  // Simple array for fast push — stale entries (from overwritten properties)
  // are harmless because BFS skips them via the modified=false check.
  // (lazy: only allocated when first child is added)
  children: DraftState[] | null
  // Child draft proxies created by read-only property access (GET trap).
  // Stored separately from `copy` so that reading nested properties does
  // NOT trigger prepareCopy (a shallowCopy of the parent). Lazily allocated
  // on first child draft creation.
  childDrafts: Map<any, Drafted> | null
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
    s.childDrafts = null
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
    version: 0,
    children: null,
    childDrafts: null, // lazy, created on first child draft in GET trap
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
  // NOTE: childDrafts are NOT merged into the stolen value.
  // DraftState identity is preserved via state.childDrafts — the GET trap
  // checks childDrafts first, so it doesn't need draft proxy refs in state.base.
  // This allows us to resolve draft proxies in-place below (no second clone).
  state.base = value as any
  state.copy = null
  state.modified = false
  return value
}

/**
 * Resolve a value for snapshot consumption. Replaces draft proxies with
 * their resolved plain values using copy-on-write semantics — only clones
 * objects that actually contain draft proxy references. Original objects
 * (including stolen copies) are never modified.
 *
 * @param clones - Map of DraftState → resolved clone for modified states.
 *   For unmodified states, falls back to state.base (original, structural sharing).
 * @param seen - Visited set to prevent infinite recursion on circular references.
 */
function resolveValue(
  value: any,
  clones: Map<DraftState, any>,
  cache: Map<any, any> | null,
  seen: Set<any>
): any {
  if (!isObject(value)) return value

  if (isDraft(value)) {
    // Check cache for structural sharing across snapshots
    if (cache) {
      const cached = cache.get(value)
      if (cached) return cached
    }
    const state: DraftState = value[ReactiveFlags.STATE]
    // clones: modified state resolved as clone (stolen + resolved)
    // state.copy: orphan/foreign draft not in clones (live copy with modifications)
    // state.base: unmodified draft (original, structural sharing)
    const resolved = clones.get(state) || state.copy || state.base
    if (cache) cache.set(value, resolved)
    return resolved
  }

  if (value[ReactiveFlags.SKIP] || Object.isFrozen(value) || seen.has(value)) {
    return value
  }
  seen.add(value)

  if (isArray(value)) {
    let result = value
    for (let i = 0; i < value.length; i++) {
      const resolved = resolveValue(value[i], clones, cache, seen)
      if (resolved !== value[i]) {
        if (result === value) result = value.slice() // copy-on-write
        result[i] = resolved
      }
    }
    return result
  }

  if (value instanceof Map) {
    let result = value
    value.forEach((v: any, k: any) => {
      const resolved = resolveValue(v, clones, cache, seen)
      if (resolved !== v) {
        if (result === value) result = new Map(value) // copy-on-write
        result.set(k, resolved)
      }
    })
    return result
  }

  if (value instanceof Set) {
    const replacements: [any, any][] = []
    value.forEach((v: any) => {
      const resolved = resolveValue(v, clones, cache, seen)
      if (resolved !== v) {
        replacements.push([v, resolved])
      }
    })
    if (replacements.length === 0) return value
    const result = new Set(value)
    for (let i = 0; i < replacements.length; i++) {
      result.delete(replacements[i][0])
      result.add(replacements[i][1])
    }
    return result
  }

  // Plain object
  let result = value
  const keys = Object.keys(value)
  for (let i = 0; i < keys.length; i++) {
    const desc = Object.getOwnPropertyDescriptor(value, keys[i])
    if (desc && 'value' in desc) {
      const resolved = resolveValue(desc.value, clones, cache, seen)
      if (resolved !== desc.value) {
        if (result === value) result = shallowCopy(value) // copy-on-write
        result[keys[i]] = resolved
      }
    }
  }
  return result
}

/**
 * Resolve draft proxy refs IN-PLACE in stolen copies for modified states.
 * Since DraftState identity is now preserved via state.childDrafts (the GET
 * trap checks childDrafts first), we no longer need to keep draft proxy refs
 * in state.base. This allows in-place resolution — no second shallowCopy.
 *
 * Processes leaf-first so child bases are available when resolving parents.
 */
function resolveStates(
  modified: DraftState[],
  hasDraftableAssignment: boolean,
  cache: Map<any, any> | null
): Map<DraftState, any> {
  const resolved = new Map<DraftState, any>()
  const seen = new Set<any>()

  for (let i = modified.length - 1; i >= 0; i--) {
    const state = modified[i]
    // state.base is the stolen copy — resolve draft refs IN-PLACE.
    const target = state.base

    // Resolve child draft proxies from childDrafts map.
    // The stolen copy may have the draft proxy (if prepareCopy transferred it)
    // or the original plain object (if no SET on this parent). Either way,
    // replace with the child's resolved base.
    if (state.childDrafts) {
      if (target instanceof Map) {
        state.childDrafts.forEach((childProxy, key) => {
          const childState = childProxy[ReactiveFlags.STATE] as DraftState
          if (!childState) return
          const res =
            resolved.get(childState) ||
            (cache && cache.get(childProxy)) ||
            childState.base
          target.set(key, res)
        })
      } else if (!(target instanceof Set)) {
        state.childDrafts.forEach((childProxy, key) => {
          const childState = childProxy[ReactiveFlags.STATE] as DraftState
          if (!childState) return
          const res =
            resolved.get(childState) ||
            (cache && cache.get(childProxy)) ||
            childState.base
          target[key as any] = res
        })
      }
    }
    // Also resolve children stored in copy via SET trap (e.g. draft.foo = draft.bar).
    // These are tracked in state.children but NOT in childDrafts.
    if (state.children) {
      if (target instanceof Map) {
        for (let j = 0; j < state.children.length; j++) {
          const child = state.children[j]
          if (child.key !== NO_KEY && target.get(child.key) === child.proxy) {
            target.set(
              child.key,
              resolved.get(child) ||
                (cache && cache.get(child.proxy)) ||
                child.base
            )
          }
        }
      } else if (!(target instanceof Set)) {
        for (let j = 0; j < state.children.length; j++) {
          const child = state.children[j]
          if (
            child.key !== NO_KEY &&
            target[child.key as any] === child.proxy
          ) {
            target[child.key as any] =
              resolved.get(child) ||
              (cache && cache.get(child.proxy)) ||
              child.base
          }
        }
      }
    }

    // Resolve draft proxies at user-assigned keys (rename, multi-ref,
    // nested-in-plain-object, cross-root foreign drafts).
    if (state.assignedMap) {
      state.assignedMap.forEach((assigned, key) => {
        if (!assigned) return
        const val =
          target instanceof Map ? target.get(key) : (target as any)[key]
        if (val === null || typeof val !== 'object') return
        if (val[ReactiveFlags.STATE]) {
          const cs = val[ReactiveFlags.STATE] as DraftState
          let res = resolved.get(cs)
          if (!res) {
            res = cs.copy ?? cs.base
            res = resolveValue(res, resolved, null, seen)
          }
          if (target instanceof Map) target.set(key, res)
          else (target as any)[key] = res
        } else if (hasDraftableAssignment) {
          const res = resolveValue(val, resolved, null, seen)
          if (res !== val) {
            if (target instanceof Map) target.set(key, res)
            else (target as any)[key] = res
          }
        }
      })
    }

    // Resolve Set draft proxies.
    if (state.type === DraftType.Set) {
      const setState = state as any as SetDraftState
      const draftsMap = setState.drafts?.size > 0 ? setState.drafts : undefined
      const setTarget = target as any as Set<any>
      const values = Array.from(setTarget)
      let changed = false
      for (let j = 0; j < values.length; j++) {
        const v = values[j]
        if (draftsMap) {
          const drafted = draftsMap.get(v)
          if (drafted) {
            values[j] = (drafted[ReactiveFlags.STATE] as DraftState).base
            changed = true
            continue
          }
        }
        if (v !== null && typeof v === 'object' && v[ReactiveFlags.STATE]) {
          values[j] = (v[ReactiveFlags.STATE] as DraftState).base
          changed = true
        }
      }
      if (changed) {
        setTarget.clear()
        for (let j = 0; j < values.length; j++) {
          setTarget.add(values[j])
        }
      }
    }

    resolved.set(state, target)
    if (cache) cache.set(state.proxy, target)
  }

  return resolved
}

export function snapshot<T>(
  value: T,
  draft: Drafted,
  snapshots?: Map<any, any>
): T {
  if (!isObject(value)) {
    return value
  }

  const rootState: DraftState = draft[ReactiveFlags.STATE]
  if (!rootState.modified) {
    // Unmodified — resolve value (may be a view result with draft refs,
    // though rare when root is unmodified).
    return resolveValue(value, new Map(), snapshots || null, new Set()) as T
  }

  // BFS: collect and steal modified states
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

  // Clear cache entries for modified states (they have new values)
  if (snapshots) {
    for (let i = 0; i < modified.length; i++) {
      snapshots.delete(modified[i].proxy)
    }
  }

  // Resolve draft proxy refs in-place in stolen copies (no second shallowCopy)
  const resolved = resolveStates(
    modified,
    !!rootState.root.hasDraftableAssignment,
    snapshots || null
  )

  // Resolve the requested value using resolved map for structural sharing
  return resolveValue(value, resolved, snapshots || null, new Set()) as T
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
