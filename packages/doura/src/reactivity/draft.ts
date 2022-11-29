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
import { NOOP, isObject, shallowCopy } from '../utils'
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
  const copies = new Map()
  const draftSnapshot: DraftSnapshot = {
    copies,
    proxies: new Map(),
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
    copies.set(state, value)
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
    return new Proxy(draftSnapshot.copies.get(state), handler)
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

function updateDraftState(state: DraftState, base: AnyObject) {
  state.modified = false
  state.base = base
  state.assigned = {}
}
