import {
  Target,
  TargetType,
  ReactiveFlags,
  getTargetType,
  isDraft,
  Drafted,
} from './common'
import { mutableHandlers } from './baseHandlers'
import { DraftSnapshot, snapshotHandler } from './baseSnapshotHandler'
import {
  isFrozen,
  hasOwn,
  each,
  set,
  NOOP,
  isObject,
  shallowCopy,
} from '../utils'
import { AnyObject, Objectish } from '../types'

export type PatchPath = (string | number)[]

export const draftMap = new WeakMap<any, any>()

export interface DraftState {
  id: number
  // The root state.
  root: DraftState
  // The parent state.
  parent?: DraftState
  // The base object.
  base: AnyObject
  // The base proxy.
  proxy: AnyObject
  // The base copy with any updated values.
  copy: AnyObject | null
  // Track which properties have been assigned (true) or deleted (false).
  assigned: Record<string, boolean>
  // True for both shallow and deep changes.
  modified: boolean
  // Ture after being disposed
  disposed: boolean
  // listener
  listeners: Array<() => void>
  // all drafts created by the root.
  children: DraftState[]
}

export function isDraftable(value: any): boolean {
  if (!value) return false
  return getTargetType(value) !== TargetType.INVALID
}

export function disposeDraft(draft: Drafted) {
  const state: DraftState = draft[ReactiveFlags.STATE]
  state.disposed = true
}

let uid = 0
export function draft<T extends Objectish>(
  target: T & Target,
  parent?: DraftState
): T & Drafted {
  if (!isObject(target)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }

  // target is already a Draft, return it.
  if (target[ReactiveFlags.STATE]) {
    return target as any
  }

  // only specific value types can be observed.
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target as any
  }

  const isArray = Array.isArray(target)
  let state: DraftState = {
    id: uid++,
    root: null as any, // set below
    parent: parent,
    base: target,
    proxy: null as any, // set below
    copy: null,
    assigned: {},
    modified: false,
    disposed: false,
    listeners: [],
    children: [],
  }
  if (isArray) {
    const initValue = state
    state = [] as any as DraftState
    Object.keys(initValue).forEach((key) => {
      Object.defineProperty(state, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: initValue[key as keyof typeof initValue],
      })
    })
  }

  const proxy = new Proxy(state, mutableHandlers)
  state.proxy = proxy
  if (parent) {
    state.root = parent.root
    parent.children.push(state)
  } else {
    state.root = state
  }

  state.children = []
  draftMap.set(state, proxy)

  return state.proxy as any
}

export function finishDraft(draft: AnyObject) {
  return finalize(draft, [])
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

export function takeSnapshotFromDraft(draft: Drafted): DraftSnapshot {
  const draftSnapshot: DraftSnapshot = new Map()
  if (!isDraft(draft)) {
    return draftSnapshot
  }

  const queue = [draft[ReactiveFlags.STATE]]
  while (queue.length) {
    const state = queue.pop()!
    let value: any
    if (state.modified) {
      value = shallowCopy(state.copy)
      updateDraftState(state, value)
    } else {
      value = state.base
    }
    draftSnapshot.set(state, value)
    for (const c of state.children) {
      queue.push(c)
    }
  }

  return draftSnapshot
}

export function createSnapshotProxy(obj: any, draftSnapshot: DraftSnapshot) {
  const handler = snapshotHandler(draftSnapshot)
  if (isDraft(obj)) {
    const state: DraftState = obj[ReactiveFlags.STATE]
    return new Proxy(draftSnapshot.get(state), handler)
  }

  return new Proxy(shallowCopy(obj), handler)
}

export function snapshot<T extends any>(value: T, draft: Drafted): T {
  if (!isObject(value)) {
    return value
  }

  const draftSnapshot = takeSnapshotFromDraft(draft)
  return createSnapshotProxy(value, draftSnapshot)
}

function finalize(value: any, path?: PatchPath) {
  if (isFrozen(value)) return value
  const state: DraftState = value[ReactiveFlags.STATE]
  // A plain object, might need freezing, might contain drafts
  if (!state) {
    each(
      value,
      (key, childValue) => {
        finalizeProperty(state, value, key, childValue, path)
      },
      true // See #590, don't recurse into non-enumerable of non drafted objects
    )
    return value
  }

  if (state.disposed) {
    throw new Error('todo')
  }

  // Unmodified draft, return the (frozen) original
  if (!state.modified) {
    return state.base
  }
  // Not finalized yet, let's do that now
  const result = state.copy!
  // Finalize all children of the copy
  each(result, (key, childValue) =>
    finalizeProperty(state, result, key, childValue, path)
  )
  return result
}

function updateDraftState(state: DraftState, base: AnyObject) {
  state.modified = false
  state.base = base
  state.assigned = {}
}

function finalizeProperty(
  parentState: undefined | DraftState,
  targetObject: any,
  prop: string | number,
  childValue: any,
  rootPath?: PatchPath
) {
  if (process.env.NODE_ENV === 'development' && childValue === targetObject)
    throw new Error('forbids circular references')

  if (isDraft(childValue)) {
    const path =
      rootPath && parentState && !hasOwn(parentState.assigned, prop) // Skip deep patches for assigned keys.
        ? rootPath!.concat(prop)
        : undefined
    const res = finalize(childValue, path)
    set(targetObject, prop, res)
    if (!isDraft(res)) {
      return
    }
  }

  // Search new objects for unfinalized drafts. Frozen objects should never contain drafts.
  if (isDraftable(childValue) && !isFrozen(childValue)) {
    finalize(childValue)
  }
}
