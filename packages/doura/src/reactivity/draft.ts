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
import { isObject, isArray, shallowCopy } from '../utils'
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
  // Child draft proxies keyed by property/map key.
  // Serves as both a GET trap cache (avoids re-creating drafts) and the
  // tree structure for DFS traversal during snapshot. Lazily allocated.
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

/**
 * Discard orphaned child drafts from the draft tree.
 * Clears childDrafts and resets copy on all descendant states,
 * so the next property access rebuilds from the current base/copy.
 * Used after replace() to prevent accumulation from previous state trees.
 */
export function resetDraftChildren(draft: Drafted) {
  const root: DraftState = draft[ReactiveFlags.STATE]
  if (!root.childDrafts) return
  const queue: DraftState[] = []
  root.childDrafts.forEach((childProxy) => {
    const s: DraftState | undefined = childProxy[ReactiveFlags.STATE]
    if (s) queue.push(s)
  })
  root.childDrafts = null
  while (queue.length) {
    const s = queue.pop()!
    if (s.childDrafts) {
      s.childDrafts.forEach((childProxy) => {
        const cs: DraftState | undefined = childProxy[ReactiveFlags.STATE]
        if (cs) queue.push(cs)
      })
      s.childDrafts = null
    }
    if (s.type === DraftType.Set) {
      const setState = s as any as SetDraftState
      if (setState.drafts && setState.drafts.size > 0) {
        setState.drafts.forEach((draftProxy) => {
          const ds: DraftState | undefined = draftProxy[ReactiveFlags.STATE]
          if (ds) queue.push(ds)
        })
      }
    }
    s.copy = null
  }
}

// Sentinel for "no key set" — distinguishes from undefined which
// is a valid Map key.
const NO_KEY = Symbol.for('__doura_no_key')

let uid = 0

/**
 * Initialize DraftState properties on a non-plain-object target (Array/Map/Set).
 * Direct property assignment avoids Object.assign overhead on non-plain targets
 * (~14x faster for Array instances in V8).
 */
function initDraftState(
  target: any,
  type: DraftType,
  base: any,
  parent: DraftState | undefined,
  key: any
) {
  target.type = type
  target.id = uid++
  target.root = null
  target.parent = parent
  target.key = key
  target.base = base
  target.proxy = null
  target.copy = null
  target.modified = false
  target.assignedMap = null
  target.listeners = null
  target.childDrafts = null
}

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

  if (target[ReactiveFlags.RAW] || !Object.isExtensible(target)) {
    return target as any
  }

  // target is already a Draft, return it.
  if (target[ReactiveFlags.STATE]) {
    return target as any
  }

  const keyValue = arguments.length >= 3 ? key : NO_KEY
  let proxyTarget: DraftState
  let proxyHandlers: ProxyHandler<any>

  if (targetType === TargetType.SET) {
    const s: any = new Set()
    initDraftState(s, DraftType.Set, target, parent, keyValue)
    s.drafts = new Map()
    proxyTarget = s
    proxyHandlers = mutableCollectionHandlers
  } else if (targetType === TargetType.MAP) {
    const m: any = new Map()
    initDraftState(m, DraftType.Map, target, parent, keyValue)
    proxyTarget = m
    proxyHandlers = mutableCollectionHandlers
  } else if (targetType === TargetType.ARRAY) {
    // Direct property assignment on Array instance avoids Object.assign
    // overhead (~14x faster for 13 properties on non-plain-object targets).
    const arr: any = []
    initDraftState(arr, DraftType.Object, target, parent, keyValue)
    proxyTarget = arr
    proxyHandlers = mutableHandlers
  } else {
    proxyTarget = {
      type: DraftType.Object,
      id: uid++,
      root: null as any,
      parent: parent,
      key: keyValue,
      base: target,
      proxy: null as any,
      copy: null,
      modified: false,
      assignedMap: null,
      listeners: null,
      childDrafts: null,
    }
    proxyHandlers = mutableHandlers
  }

  const proxy = new Proxy(proxyTarget, proxyHandlers)
  proxyTarget.proxy = proxy
  if (parent) {
    proxyTarget.root = parent.root
    // Register in parent's childDrafts for DFS traversal and resolution.
    // Set elements (keyValue === NO_KEY) are tracked via SetDraftState.drafts instead.
    if (keyValue !== NO_KEY) {
      if (!parent.childDrafts) parent.childDrafts = new Map()
      parent.childDrafts.set(keyValue, proxy)
    }
  } else {
    proxyTarget.root = proxyTarget
  }

  return proxyTarget.proxy as any
}

export function watch(draft: any, cb: () => void): () => void {
  const state: DraftState = draft[ReactiveFlags.STATE]

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

  if (value[ReactiveFlags.RAW] || Object.isFrozen(value) || seen.has(value)) {
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
 * Since DraftState identity is preserved via state.childDrafts (the GET
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

  // modified is in DFS post-order (leaf-first), iterate forward.
  for (let i = 0; i < modified.length; i++) {
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
            // copy is a live mutable object — shallowCopy to detach so
            // future writes to the foreign draft don't pollute this snapshot.
            // base is safe (future writes go to a new copy via prepareCopy).
            res = cs.copy ? shallowCopy(cs.copy) : cs.base
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

/**
 * DFS post-order collection of modified states via childDrafts.
 * Post-order ensures children appear before parents in the result,
 * so stealAndReset and resolveStates process leaves first.
 */
function collectModified(
  state: DraftState,
  result: DraftState[],
  visited: Set<DraftState>
) {
  if (visited.has(state)) return
  visited.add(state)

  // Traverse children via childDrafts
  if (state.childDrafts) {
    state.childDrafts.forEach((proxy) => {
      const childState: DraftState | undefined = proxy[ReactiveFlags.STATE]
      if (childState && childState.modified) {
        collectModified(childState, result, visited)
      }
    })
  }

  // For Sets: also traverse state.drafts for element drafts
  if (state.type === DraftType.Set) {
    const setState = state as any as SetDraftState
    if (setState.drafts && setState.drafts.size > 0) {
      setState.drafts.forEach((draftProxy) => {
        const ds: DraftState | undefined = draftProxy[ReactiveFlags.STATE]
        if (ds && ds.modified) {
          collectModified(ds, result, visited)
        }
      })
    }
  }

  result.push(state) // post-order: children already pushed
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

  // DFS post-order: collect modified states (leaf-first)
  const modified: DraftState[] = []
  const visited = new Set<DraftState>()
  collectModified(rootState, modified, visited)

  // Steal all (already in leaf-first order from DFS post-order)
  for (let i = 0; i < modified.length; i++) {
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
