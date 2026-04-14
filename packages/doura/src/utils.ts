import { AnyObject } from './types'

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
const toTypeString = (value: unknown): string => objectToString.call(value)

export const isArray = Array.isArray
export const isMap = (val: unknown): val is Map<any, any> =>
  toTypeString(val) === '[object Map]'
const isSet = (val: unknown): val is Set<any> =>
  toTypeString(val) === '[object Set]'

const isString = (val: unknown): val is string => typeof val === 'string'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'

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
// Copies only own enumerable string keys + enumerable symbol keys
// (same behavior as Mutative). Non-enumerable properties are NOT preserved.
// Object.getOwnPropertyNames is ~3x slower than Object.keys for large
// objects — skipping it is the key speedup for the object benchmark.
// Use markStrict() to opt specific objects into full strictCopy.
function quickCopyObj(base: any) {
  const enumKeys = Object.keys(base)
  const copy: Record<string | symbol, any> = {}
  for (let i = 0; i < enumKeys.length; i++) {
    copy[enumKeys[i]] = base[enumKeys[i]]
  }
  const symbols = Object.getOwnPropertySymbols(base)
  for (let i = 0; i < symbols.length; i++) {
    const key: any = symbols[i]
    if (isEnumerable.call(base, key)) {
      copy[key] = base[key]
    }
  }
  return copy
}

// ReactiveFlags.STRICT is a const enum, inlined at compile time.
// We use the string value directly to avoid a circular import.
const STRICT_FLAG = '__r_strict'

export function shallowCopy(base: any) {
  if (Array.isArray(base)) return slice.call(base)
  if (isMap(base)) return new Map(base)
  if (isSet(base)) return new Set(base)
  // markStrict() opt-in: full copy preserving all property descriptors
  if (base[STRICT_FLAG]) return strictCopy(base)
  const proto = Object.getPrototypeOf(base)
  if (proto === Object.prototype || proto === null) {
    return quickCopyObj(base)
  }
  return strictCopy(base)
}

/**
 * O(1) removal from an unordered array via swap-with-last + pop.
 */
export function removeUnordered<T>(arr: T[], item: T): void {
  const index = arr.indexOf(item)
  if (index < 0) return
  const last = arr.pop()!
  if (index < arr.length) {
    arr[index] = last
  }
}

const ownKeys: (target: object) => PropertyKey[] =
  typeof Reflect !== 'undefined' && Reflect.ownKeys
    ? Reflect.ownKeys
    : typeof Object.getOwnPropertySymbols !== 'undefined'
    ? (obj) =>
        Object.getOwnPropertyNames(obj).concat(
          Object.getOwnPropertySymbols(obj) as any
        )
    : /* istanbul ignore next */ Object.getOwnPropertyNames
