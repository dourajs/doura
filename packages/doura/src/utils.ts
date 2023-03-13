import { AnyObject, Objectish } from './types'

export const NOOP = () => {
  // do nothing
}

export const emptyObject = Object.create(null)
export const emptyArray = [] as const

export const assign = Object.assign

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: PropertyKey
): key is keyof typeof val => hasOwnProperty.call(val, key)

export const objectToString = Object.prototype.toString
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

export const isArray = Array.isArray
export const isMap = (val: unknown): val is Map<any, any> =>
  toTypeString(val) === '[object Map]'
export const isSet = (val: unknown): val is Set<any> =>
  toTypeString(val) === '[object Set]'

export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'
export const isString = (val: unknown): val is string => typeof val === 'string'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'

export const toRawType = (value: unknown): string => {
  // extract "RawType" from strings like "[object RawType]"
  return toTypeString(value).slice(8, -1)
}

export const isPlainObject = (val: unknown): val is AnyObject =>
  toTypeString(val) === '[object Object]'

export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key

// compare whether a value has changed, accounting for NaN.
export const is = (value: any, oldValue: any): boolean =>
  Object.is(value, oldValue)

export const def = (obj: object, key: string | symbol, value: any) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value,
  })
}

export function invariant(condition: any, message?: string): asserts condition {
  if (condition) {
    return
  }
  // Condition not passed

  // When not in production we allow the message to pass through
  // *This block will be removed in production builds*
  throw new Error(`[Doura] ${message || ''}`)
}

const slice = Array.prototype.slice

function strictCopy(base: any) {
  const descriptors = Object.getOwnPropertyDescriptors(base)
  const keys = ownKeys(descriptors)
  for (let i = 0; i < keys.length; i++) {
    const key: any = keys[i]
    const desc = descriptors[key]
    if (desc.writable === false) {
      desc.writable = true
      desc.configurable = true
    }
    // like object.assign, we will read any _own_, get/set accessors. This helps in dealing
    // with libraries that trap values, like mobx or vue
    // unlike object.assign, non-enumerables will be copied as well
    if (desc.get || desc.set)
      descriptors[key] = {
        configurable: true,
        writable: true, // could live with !!desc.set as well here...
        enumerable: desc.enumerable,
        value: base[key],
      }
  }
  return Object.create(Object.getPrototypeOf(base), descriptors)
}

const isEnumerable = Object.prototype.propertyIsEnumerable

// For best performance with shallow copies,
// don't use `Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));` by default.
function quickCopyObj(base: any) {
  const copy: Record<string | symbol, any> = {}
  const keys = ownKeys(base)
  for (let i = 0; i < keys.length; i++) {
    const key: any = keys[i]
    const target = base[key]
    if (isEnumerable.call(base, key)) {
      copy![key] = target
    } else {
      Object.defineProperty(copy, key, {
        configurable: true,
        writable: true,
        enumerable: false,
        value: target,
      })
    }
  }
  return copy
}

export function shallowCopy(base: any) {
  if (Array.isArray(base)) return slice.call(base)
  if (isMap(base)) return new Map(base)
  if (isSet(base)) return new Set(base)
  if (Object.getPrototypeOf(base) === Object.prototype) {
    return quickCopyObj(base)
  }
  return strictCopy(base)
}

export const ownKeys: (target: object) => PropertyKey[] =
  typeof Reflect !== 'undefined' && Reflect.ownKeys
    ? Reflect.ownKeys
    : typeof Object.getOwnPropertySymbols !== 'undefined'
    ? (obj) =>
        Object.getOwnPropertyNames(obj).concat(
          Object.getOwnPropertySymbols(obj) as any
        )
    : /* istanbul ignore next */ Object.getOwnPropertyNames

export function each<T extends Objectish>(
  obj: T,
  iter: (key: string | number, value: any, source: T) => void,
  enumerableOnly?: boolean
): void
export function each(obj: any, iter: any, enumerableOnly = false) {
  if (isPlainObject(obj)) {
    ;(enumerableOnly ? Object.keys : ownKeys)(obj).forEach((key) => {
      if (!enumerableOnly || typeof key !== 'symbol')
        iter(key, obj[key as any], obj)
    })
  } else {
    obj.forEach((entry: any, index: any) => iter(index, entry, obj))
  }
}

export function set(thing: any, propOrOldValue: PropertyKey, value: any) {
  if (isMap(thing)) thing.set(propOrOldValue, value)
  else if (isSet(thing)) {
    thing.delete(propOrOldValue)
    thing.add(value)
  } else thing[propOrOldValue] = value
}
