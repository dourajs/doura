import { DraftState, draft, draftMap } from './draft'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import {
  ReactiveFlags,
  Target,
  toBase,
  toState,
  latest,
  prepareCopy,
  markChanged,
} from './common'
import {
  track,
  trackDraft,
  trigger,
  ITERATE_KEY,
  pauseTracking,
  resetTracking,
} from './effect'
import { isObject, hasOwn, isSymbol, is, isArray, isIntegerKey } from '../utils'
import { warn } from '../warning'

export type ProxyGetterHandler = ProxyHandler<object>['get']

export type ProxyGetter = ProxyGetterHandler

const isNonTrackableKeys = new Set<any>([`__proto__`])

const builtInSymbols = new Set(
  /*#__PURE__*/
  Object.getOwnPropertyNames(Symbol)
    // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
    // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
    // function
    .filter((key) => key !== 'arguments' && key !== 'caller')
    .map((key) => (Symbol as any)[key])
    .filter(isSymbol)
)

// Access a property without creating a proxy.
function peek(obj: Target, prop: PropertyKey) {
  const state = obj[ReactiveFlags.STATE]
  const source = state ? latest(state) : obj
  return (source as any)[prop]
}

const get = /*#__PURE__*/ createGetter()

const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations()

function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {}
  // instrument identity-sensitive Array methods to account for possible reactive
  // values
  ;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      const state = toState(this)!
      const arr = latest(state)
      for (let i = 0, l = this.length; i < l; i++) {
        track(state, TrackOpTypes.GET, i + '', Reflect.get(arr, i))
      }
      // we run the method using the original args first (which may be reactive)
      const res = arr[key](...args)
      if (res === -1 || res === false) {
        // if that didn't work, run it again using raw values.
        return arr[key](...args.map(toBase))
      } else {
        return res
      }
    }
  })
  // instrument length-altering mutation methods to avoid length being tracked
  // which leads to infinite loops in some cases (#2137)
  ;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      pauseTracking()
      let state = toState(this)!
      let target = latest(state)
      const res = target[key].apply(this, args)
      resetTracking()
      return res
    }
  })
  return instrumentations
}

function createGetter(): ProxyGetter {
  return function get(state: DraftState, prop: PropertyKey, receiver: object) {
    const target = latest(state)
    if (prop === ReactiveFlags.IS_REACTIVE) {
      return true
    } else if (
      prop === ReactiveFlags.STATE &&
      receiver === draftMap.get(state)
    ) {
      return state
    }

    const targetIsArray = isArray(target)
    if (targetIsArray && hasOwn(arrayInstrumentations, prop)) {
      return Reflect.get(arrayInstrumentations, prop, receiver)
    }

    let value = Reflect.get(target, prop, receiver)
    if (
      isSymbol(prop) ? builtInSymbols.has(prop) : isNonTrackableKeys.has(prop)
    ) {
      return value
    }

    track(state, TrackOpTypes.GET, prop, value)

    if (!hasOwn(target, prop)) {
      // non-existing or non-own property...
      return value
    }

    if (state.disposed || !isObject(value)) {
      return value
    }

    // Check for existing proxy in modified state.
    // Assigned values are never proxied. This catches any proxies we created, too.
    if (value === peek(state.base, prop)) {
      prepareCopy(state)
      const res = (state.copy![prop as any] = draft(value, state))
      const resState = toState(res)
      resState && trackDraft(res[ReactiveFlags.STATE])
      return res
    } else {
      const resState = toState(value)
      resState && trackDraft(resState)
    }
    return value
  }
}

const set = /*#__PURE__*/ createSetter()

function createSetter() {
  return function set(
    state: DraftState,
    prop: string /* strictly not, but helps TS */,
    value: unknown,
    receiver: object
  ): boolean {
    const target = latest(state)
    const current = peek(target, prop)

    const hadKey =
      isArray(target) && isIntegerKey(prop)
        ? Number(prop) < target.length
        : hasOwn(target, prop)

    if (!state.modified) {
      // special case, if we assigning the original value to a draft, we can ignore the assignment
      const currentState: DraftState = current?.[ReactiveFlags.STATE]
      if (currentState && currentState.base === value) {
        state.copy![prop] = value
        state.assigned[prop] = false
        return true
      }

      // we need to be able to distinguish setting a non-existing to undefined (which is a change)
      // from setting an existing property with value undefined to undefined (which is not a change)
      if (
        is(value, current) &&
        (value !== undefined || hasOwn(state.base, prop))
      )
        return true

      prepareCopy(state)
      markChanged(state)
    }

    if (
      is(state.copy![prop], value) &&
      // special case: handle new props with value 'undefined'
      (value !== undefined || prop in state.copy!)
    )
      return true

    state.copy![prop] = value
    state.assigned[prop] = true

    // don't trigger if target is something up in the prototype chain of original
    if (state === toState(receiver)) {
      if (!hadKey) {
        trigger(state, TriggerOpTypes.ADD, prop, value)
      } else if (!is(value, current)) {
        trigger(state, TriggerOpTypes.SET, prop, value, current)
      }
    }

    return true
  }
}

function deleteProperty(state: DraftState, prop: string): boolean {
  const hadKey = hasOwn(latest(state), prop)
  const current = peek(state.base, prop)

  // The `undefined` check is a fast path for pre-existing keys.
  if (current !== undefined || prop in state.base) {
    state.assigned[prop] = false
    prepareCopy(state)
    markChanged(state)
  } else {
    // if an originally not assigned property was deleted
    delete state.assigned[prop]
  }

  if (state.copy) {
    const result = delete state.copy[prop]
    if (result && hadKey) {
      trigger(state, TriggerOpTypes.DELETE, prop, undefined, current)
    }
    return result
  }

  return true
}

function has(state: DraftState, prop: PropertyKey): boolean {
  const target = latest(state)
  const result = Reflect.has(target, prop)
  if (!isSymbol(prop) || !builtInSymbols.has(prop)) {
    track(state, TrackOpTypes.HAS, prop, result)
  }
  return result
}

function ownKeys(state: DraftState): (string | symbol)[] {
  const target = latest(state)
  track(
    state,
    TrackOpTypes.ITERATE,
    isArray(target) ? 'length' : ITERATE_KEY,
    null
  )
  return Reflect.ownKeys(target)
}

function getOwnPropertyDescriptor(state: DraftState, key: any) {
  const target = latest(state)
  const desc = Reflect.getOwnPropertyDescriptor(target, key)
  if (!desc) return desc
  return {
    writable: true,
    configurable: !isArray(target) || key !== 'length',
    enumerable: desc.enumerable,
    value: target[key],
  }
}

function setPrototypeOf(state: DraftState, v: object | null): boolean {
  if (process.env.NODE_ENV === 'development') {
    warn(`not allow setPrototypeOf to set prototype`)
  }
  const res = Reflect.setPrototypeOf(state.base, v)
  if (res && state.copy) {
    Reflect.setPrototypeOf(state.copy, v)
  }
  return res
}

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys,
  setPrototypeOf,
  getOwnPropertyDescriptor,
}
