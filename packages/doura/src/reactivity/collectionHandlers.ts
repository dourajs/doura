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

function prepareSetCopy(state: SetDraftState) {
  if (!state.copy) {
    state.copy = new Set()
    state.base.forEach((value: any) => {
      if (isObject(value)) {
        const drafted = draft(value, state)
        trackDraft(drafted)
        if (value !== drafted) {
          state.drafts.set(value, drafted)
        }
        state.copy!.add(drafted)
      } else {
        state.copy!.add(value)
      }
    })
  }
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
    value = draft(value, state)
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
  const hadKey = target.has(value)
  if (!hadKey) {
    prepareSetCopy(state)
    markChanged(state)
    state.copy!.add(value)
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

  return state.type === DraftType.Set
    ? state.drafts.has(key) && state.drafts.has(state.drafts.get(key))
    : false
}

function size(state: CollectionState) {
  track(state, TrackOpTypes.ITERATE, ITERATE_KEY)
  return latest(state).size
}

function setKeys(state: SetDraftState) {
  track(state, TrackOpTypes.ITERATE, ITERATE_KEY)
  prepareSetCopy(state)
  return state.copy!.values()
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
  let result = state.copy!.delete(key)
  if (state.type === DraftType.Set && !result) {
    result = state.drafts.has(key)
      ? state.drafts.delete(state.drafts.get(key))
      : false
  }
  if (hadKey) {
    trigger(state, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

function clear(this: CollectionTypes & Drafted) {
  const state = this[ReactiveFlags.STATE] as CollectionState
  const target = latest(state)
  const hadItems = target.size !== 0
  // forward the operation before queueing reactions
  const result = target.clear()
  if (hadItems) {
    prepareCopy(state)
    markChanged(state)
    ;(state.copy as any).clear()
    trigger(state, TriggerOpTypes.CLEAR, undefined, undefined)
  }
  return result
}

function setForEach(
  self: CollectionTypes,
  state: CollectionState,
  callback: Function,
  thisArg?: unknown
) {
  const iterator = (state.proxy as Set<any>).values()
  let result = iterator.next()
  while (!result.done) {
    callback.call(thisArg, result.value, result.value, self)
    result = iterator.next()
  }
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
  return function (
    this: CollectionTypes & Drafted,
    ...args: unknown[]
  ): Iterable & Iterator {
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
    return (state.copy as any)[method](...args)
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
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    } else if (key === ReactiveFlags.STATE) {
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
