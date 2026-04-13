import {
  draft,
  MapDraftState,
  SetDraftState,
  DraftType,
  DraftState,
} from './draft'
import { ReactiveFlags, latest, markChanged, isDraft, Drafted } from './common'
import {
  track,
  trackDraft,
  trigger,
  ITERATE_KEY,
  MAP_KEY_ITERATE_KEY,
} from './effect'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import { hasOwn, is, isObject } from '../utils'
import { AnyMap, AnySet, CollectionTypes, Iterable, Iterator } from '../types'

export type CollectionState = MapDraftState | SetDraftState

function prepareMapCopy(state: MapDraftState) {
  if (!state.copy) {
    state.copy = new Map(state.base)
  }
}

/**
 * Lazy Set copy: creates a shallow copy of the Set (original refs)
 * without drafting any elements. Drafts are created on-demand when
 * elements are accessed via iteration. This avoids O(n) proxy creation
 * when only a few elements are actually read.
 */
function prepareSetCopy(state: SetDraftState) {
  if (!state.copy) {
    state.copy = new Set(state.base)
  }
}

/**
 * Lazily draft a Set element: if the value is a draftable object and
 * hasn't been drafted yet, create a draft and cache it in state.drafts.
 * Does NOT modify state.copy (safe to call during iteration).
 * The copy is reconciled during finalization.
 */
function ensureSetValueDrafted(state: SetDraftState, value: any): any {
  if (!isObject(value)) return value
  // Already a draft proxy (e.g. added via add())
  if (isDraft(value)) return value
  // Already drafted?
  const existing = state.drafts.get(value)
  if (existing) return existing
  // Create draft lazily
  const drafted = draft(value, state)
  trackDraft(drafted)
  if (value !== drafted) {
    state.drafts.set(value, drafted)
  }
  return drafted
}

function prepareCopy(state: DraftState) {
  state.type === DraftType.Map
    ? prepareMapCopy(state)
    : prepareSetCopy(state as SetDraftState)
}

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
  }

  trackDraft(value)

  return value
}

function set(this: AnyMap & Drafted, key: any, value: unknown) {
  const state = this[ReactiveFlags.STATE] as MapDraftState
  const target = latest(state)

  const hadKey = target.has(key)
  const oldValue = target.get(key)

  const _doSet = () => {
    prepareCopy(state)
    markChanged(state)
    state.copy!.set(key, value)
    // Track child draft in childDrafts for DFS traversal and resolution.
    // Foreign drafts (different root) are not tracked — they freeze after
    // the first snapshot via assignedMap resolution.
    if (value && isDraft(value as any)) {
      const childState = (value as any)[ReactiveFlags.STATE] as DraftState
      if (childState.root === state.root) {
        if (!state.childDrafts) state.childDrafts = new Map()
        state.childDrafts.set(key, value as Drafted)
      } else {
        if (state.childDrafts) state.childDrafts.delete(key)
      }
    } else {
      if (state.childDrafts) state.childDrafts.delete(key)
      if (isObject(value as any)) {
        state.root.hasDraftableAssignment = true
      }
    }
    // Track this key as user-assigned for finalization.
    if (hadKey && state.base.has(key) && is(value, state.base.get(key))) {
      if (state.assignedMap) state.assignedMap.delete(key)
    } else {
      if (!state.assignedMap) state.assignedMap = new Map()
      state.assignedMap.set(key, true)
    }
  }

  if (!hadKey) {
    _doSet()
    trigger(state, TriggerOpTypes.ADD, key, value)
  } else if (!is(value, oldValue)) {
    _doSet()
    trigger(state, TriggerOpTypes.SET, key, value, oldValue)
  }

  return this
}

function add(this: AnySet & Drafted, value: unknown) {
  const state = this[ReactiveFlags.STATE] as SetDraftState
  const target = latest(state)
  // Check both copy and drafts map (original may have been replaced by draft)
  const hadKey = target.has(value) || state.drafts.has(value as any)
  if (!hadKey) {
    prepareSetCopy(state)
    markChanged(state)
    state.copy!.add(value)
    // Set elements are discovered via state.drafts during DFS, not childDrafts.
    // Track this value as assigned for finalization.
    if (!state.assignedMap) state.assignedMap = new Map()
    state.assignedMap.set(value, true)
    trigger(state, TriggerOpTypes.ADD, value, value)
  }
  return this
}

function has(this: CollectionTypes & Drafted, key: unknown): boolean {
  const state = this[ReactiveFlags.STATE] as CollectionState
  track(state, TrackOpTypes.HAS, key)
  if (!state.copy) {
    return state.base.has(key)
  }

  if (state.copy.has(key)) {
    return true
  }

  return state.type === DraftType.Set ? state.drafts.has(key) : false
}

function size(state: CollectionState) {
  track(state, TrackOpTypes.ITERATE, ITERATE_KEY)
  return latest(state).size
}

function setKeys(state: SetDraftState) {
  track(state, TrackOpTypes.ITERATE, ITERATE_KEY)
  prepareSetCopy(state)
  // Return a lazy iterator that drafts elements on demand
  const innerIterator = state.copy!.values()
  return {
    next() {
      const { value, done } = innerIterator.next()
      if (done) return { value, done }
      return { value: ensureSetValueDrafted(state, value), done: false }
    },
    [Symbol.iterator]() {
      return this
    },
  }
}

function mapKeys(state: MapDraftState) {
  track(state, TrackOpTypes.ITERATE, MAP_KEY_ITERATE_KEY)
  return latest(state).keys()
}

function deleteEntry(this: CollectionTypes & Drafted, key: unknown) {
  const state = this[ReactiveFlags.STATE] as CollectionState
  const target = latest(state)
  const hadKey = target.has(key)

  const oldValue = 'get' in target ? target.get(key) : undefined
  // forward the operation before queueing reactions
  prepareCopy(state)
  markChanged(state)
  // Clean up childDrafts for deleted Map key
  if (state.type === DraftType.Map && state.childDrafts) {
    state.childDrafts.delete(key)
  }
  let result = state.copy!.delete(key)
  if (state.type === DraftType.Set && !result && state.drafts.has(key)) {
    const drafted = state.drafts.get(key)
    result = state.copy!.delete(drafted)
    state.drafts.delete(key)
  }
  if (hadKey) {
    // Track this key as deleted for finalization.
    if (!state.assignedMap) state.assignedMap = new Map()
    state.assignedMap.set(key, false)
    trigger(state, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

function clear(this: CollectionTypes & Drafted) {
  const state = this[ReactiveFlags.STATE] as CollectionState
  const target = latest(state)
  const hadItems = target.size !== 0
  if (hadItems) {
    prepareCopy(state)
    markChanged(state)
    // Remove all child drafts since the collection is being emptied
    state.childDrafts = null
    ;(state.copy as any).clear()
    trigger(state, TriggerOpTypes.CLEAR, undefined, undefined)
  }
}

function setForEach(
  self: CollectionTypes,
  state: SetDraftState,
  callback: Function,
  thisArg?: unknown
) {
  track(state, TrackOpTypes.ITERATE, ITERATE_KEY)
  prepareSetCopy(state)
  // Iterate over copy and lazily draft each element
  state.copy!.forEach((value: any) => {
    const drafted = ensureSetValueDrafted(state, value)
    callback.call(thisArg, drafted, drafted, self)
  })
}

function mapForEach(
  self: CollectionTypes,
  state: CollectionState,
  callback: Function,
  thisArg?: unknown
) {
  track(state, TrackOpTypes.ITERATE, ITERATE_KEY)
  latest(state).forEach((_value: any, key: any) => {
    // important: make sure the callback is
    // 1. invoked with the reactive map as `this` and 3rd arg
    // 2. the value received should be a corresponding draft.
    return callback.call(thisArg, (state.proxy as AnyMap).get(key), key, self)
  })
}

function createIterableMethod(method: string | symbol) {
  return function (this: CollectionTypes & Drafted): Iterable & Iterator {
    const state = this[ReactiveFlags.STATE] as CollectionState
    const targetIsMap = state.type === DraftType.Map
    const isPair =
      method === 'entries' || (method === Symbol.iterator && targetIsMap)

    if (targetIsMap) {
      // skip calling `track()` because `keys()` will do it.
      const innerIterator = (state.proxy as Map<any, any>).keys()
      // return a wrapped iterator which returns observed versions of the
      // values emitted from the real iterator
      return {
        // iterator protocol
        next() {
          const { value: key, done } = innerIterator.next()
          const value = (state.proxy as AnyMap).get(key)
          return done
            ? { value, done }
            : {
                value: isPair ? [key, value] : value,
                done,
              }
        },
        // iterable protocol
        [Symbol.iterator]() {
          return this
        },
      }
    }

    track(state, TrackOpTypes.ITERATE, ITERATE_KEY)
    prepareSetCopy(state)
    // Always iterate via values() so we get individual elements,
    // not [value, value] pairs from entries(). We wrap the result
    // into pairs when isPair is true.
    const innerIterator = (state.copy as AnySet).values()
    return {
      next() {
        const { value, done } = innerIterator.next()
        if (done) return { value, done }
        const drafted = ensureSetValueDrafted(state as SetDraftState, value)
        return {
          value: isPair ? [drafted, drafted] : drafted,
          done: false,
        }
      },
      [Symbol.iterator]() {
        return this
      },
    }
  }
}

function createInstrumentations() {
  const mutableInstrumentations: Record<string, Function> = {
    get,
    get size() {
      return size((this as any)[ReactiveFlags.STATE]) as any
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    keys(this: CollectionTypes & Drafted) {
      const state = this[ReactiveFlags.STATE] as CollectionState
      return state.type === DraftType.Map ? mapKeys(state) : setKeys(state)
    },
    forEach(
      this: CollectionTypes & Drafted,
      callback: Function,
      thisArg?: unknown
    ) {
      const state = this[ReactiveFlags.STATE] as CollectionState
      if (state.type === DraftType.Map) {
        mapForEach(this, state, callback, thisArg)
      } else {
        setForEach(this, state, callback, thisArg)
      }
    },
  }

  const iteratorMethods = ['values', 'entries', Symbol.iterator]
  iteratorMethods.forEach((method) => {
    mutableInstrumentations[method as string] = createIterableMethod(method)
  })

  return [mutableInstrumentations]
}

const [mutableInstrumentations] = /* #__PURE__*/ createInstrumentations()

function createInstrumentationGetter() {
  const instrumentations = mutableInstrumentations

  return (state: CollectionState, key: string | symbol, receiver: any) => {
    if (key === ReactiveFlags.STATE) {
      return state
    }

    const target = latest(state) as CollectionTypes
    return Reflect.get(
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver
    )
  }
}

export const mutableCollectionHandlers: ProxyHandler<CollectionState> = {
  get: /*#__PURE__*/ createInstrumentationGetter(),
}
