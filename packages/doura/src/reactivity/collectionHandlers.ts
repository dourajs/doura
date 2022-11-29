import {
  draft,
  MapDraftState,
  SetDraftState,
  DraftType,
  isDraftable,
  DraftState,
} from './draft'
import { ReactiveFlags, latest, markChanged, isDraft, toState } from './common'
import {
  track,
  trackDraft,
  trigger,
  ITERATE_KEY,
  MAP_KEY_ITERATE_KEY,
} from './effect'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import { hasOwn, is } from '../utils'
import { AnyMap } from '../types'

type IterableCollections = Map<any, any> | Set<any>
type WeakCollections = WeakMap<any, any> | WeakSet<any>

export type CollectionTypes = IterableCollections | WeakCollections
export type CollectionState = MapDraftState | SetDraftState

function prepareMapCopy(state: { base: Map<any, any>; copy: Map<any, any> }) {
  if (!state.copy) {
    state.copy = new Map(state.base)
  }
}

function prepareSetCopy(state: SetDraftState) {
  if (!state.copy) {
    state.copy = new Set(state.base as Set<any>)
    ;(state.base as Set<any>).forEach((value: any) => {
      if (isDraftable(value)) {
        const drafted = draft(value, state as any)
        state.drafts.set(value, drafted)
        state.copy!.add(drafted)
      } else {
        state.copy!.add(value)
      }
    })
  }
}

function prepareCopy(state: DraftState) {
  state.type === DraftType.Map
    ? prepareMapCopy(state as any)
    : prepareSetCopy(state as any)
}

const getProto = <T extends CollectionTypes>(v: T): any =>
  Reflect.getPrototypeOf(v)

function get(this: MapDraftState, key: unknown) {
  const target = latest(this)
  track(this, TrackOpTypes.GET, key)
  const value = target.get(key)
  if (!isDraft(value)) {
    prepareCopy(this)
    const res = draft(value, this)
    this.copy!.set(key, res)
    const resState = toState(res)
    resState && trackDraft(res[ReactiveFlags.STATE])
    return res
  }

  return value
}

function has(this: CollectionState, key: unknown): boolean {
  track(this, TrackOpTypes.HAS, key)
  if (!this.copy) {
    return this.base.has(key)
  }

  if (this.copy.has(key)) {
    return true
  }

  return this.type === DraftType.Set
    ? this.drafts.has(key) && this.drafts.has(this.drafts.get(key))
    : false
}

function size(state: CollectionState) {
  track(state, TrackOpTypes.ITERATE, ITERATE_KEY)
  return (latest(state) as IterableCollections).size
}

function add(this: SetDraftState, value: unknown) {
  const target = latest(this)
  const proto = getProto(target)
  const hadKey = proto.has.call(target, value)
  if (!hadKey) {
    target.add(value)
    trigger(this, TriggerOpTypes.ADD, value, value)
  }
  return this
}

function set(this: MapDraftState, key: any, value: unknown) {
  const target = latest(this)
  const { has, get } = getProto(target)

  const hadKey = has.call(target, key)
  const oldValue = get.call(target, key)

  const _doSet = () => {
    prepareCopy(this)
    markChanged(this)
    this.copy!.set(key, value)
  }

  if (!hadKey) {
    _doSet()
    trigger(this, TriggerOpTypes.ADD, key, value)
  } else if (!is(value, oldValue)) {
    _doSet()
    trigger(this, TriggerOpTypes.SET, key, value, oldValue)
  }

  return this
}

function keys(this: CollectionState) {
  track(this, TrackOpTypes.ITERATE, MAP_KEY_ITERATE_KEY)
  return (latest(this) as any).keys()
}

function deleteEntry(this: CollectionState, key: unknown) {
  const target = latest(this)
  const { has, get } = getProto(target)
  const hadKey = has.call(target, key)

  const oldValue = get ? get.call(target, key) : undefined
  // forward the operation before queueing reactions
  prepareCopy(this)
  markChanged(this)
  let result = this.copy!.delete(key)
  if (this.type === DraftType.Set && !result) {
    result = this.drafts.has(key)
      ? this.copy!.delete(this.drafts.get(key))
      : false
  }
  if (hadKey) {
    trigger(this, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

function clear(this: CollectionState) {
  const target = latest(this) as IterableCollections
  const hadItems = target.size !== 0
  const oldTarget = __DEV__
    ? this.type === DraftType.Map
      ? new Map(target)
      : new Set(target)
    : undefined
  // forward the operation before queueing reactions
  const result = target.clear()
  if (hadItems) {
    prepareCopy(this)
    markChanged(this)
    ;(this.copy as any).clear()
    trigger(this, TriggerOpTypes.CLEAR, undefined, undefined, oldTarget)
  }
  return result
}

function createForEach() {
  return function forEach(
    this: CollectionState,
    callback: Function,
    thisArg?: unknown
  ) {
    if (this.type === DraftType.Map) {
      track(this, TrackOpTypes.ITERATE, ITERATE_KEY)
      ;(latest(this) as IterableCollections).forEach(
        (_value: any, key: any) => {
          // important: make sure the callback is
          // 1. invoked with the reactive map as `this` and 3rd arg
          // 2. the value received should be a corresponding draft.
          return callback.call(
            thisArg,
            (this.proxy as AnyMap).get(key),
            key,
            this
          )
        }
      )
    } else {
      const iterator = (this.proxy as Set<any>).values()
      let result = iterator.next()
      while (!result.done) {
        callback.call(thisArg, result.value, result.value, this)
        result = iterator.next()
      }
    }
  }
}

interface Iterable {
  [Symbol.iterator](): Iterator
}

interface Iterator {
  next(value?: any): IterationResult
}

interface IterationResult {
  value: any
  done?: boolean
}

function createIterableMethod(method: string | symbol) {
  return function (
    this: CollectionState,
    ...args: unknown[]
  ): Iterable & Iterator {
    const state = this
    const target = latest(state) as IterableCollections
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
                value: isPair ? [key, value] : key,
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
    return (target as any)[method](...args)
  }
}

function createInstrumentations() {
  const mutableInstrumentations: Record<string, Function> = {
    get,
    get size() {
      return size(this as unknown as CollectionState) as any
    },
    has,
    add,
    set,
    keys,
    delete: deleteEntry,
    clear,
    forEach: createForEach(),
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

  return (
    state: CollectionState,
    key: string | symbol,
    receiver: CollectionTypes
  ) => {
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
