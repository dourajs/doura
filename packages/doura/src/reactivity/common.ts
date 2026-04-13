import { AnyObject, AnySet, AnyMap } from '../types'
import { def, objectToString } from '../utils'
import {
  DraftState,
  ObjectDraftState,
  MapDraftState,
  SetDraftState,
} from './draft'

export declare const RawSymbol: unique symbol

export const enum ReactiveFlags {
  RAW = '__r_raw',
  STRICT = '__r_strict',
  STATE = '__r_state',
}

export interface Target {
  [ReactiveFlags.RAW]?: boolean
  [ReactiveFlags.STATE]?: DraftState
}

export type Drafted = {
  [ReactiveFlags.STATE]: DraftState
}

export const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  ARRAY = 2,
  SET = 3,
  MAP = 4,
}

export function getTargetType(value: any) {
  // Fast type checks (same approach as Immer/Mutative) avoid the
  // Object.prototype.toString + .slice overhead of toRawType.
  if (Array.isArray(value)) return TargetType.ARRAY
  if (value instanceof Map) return TargetType.MAP
  if (value instanceof Set) return TargetType.SET
  // Fast path: constructor check is ~10x faster than toString.
  // Covers plain objects, class instances, and Object.create(null).
  if (value === null || value === undefined) return TargetType.INVALID
  const ctor = value.constructor
  if (ctor === Object) return TargetType.COMMON
  // Class instances and Object.create(null) both need toString fallback
  // to distinguish from Date, RegExp, etc.
  if (objectToString.call(value) === '[object Object]') return TargetType.COMMON
  return TargetType.INVALID
}

export function markRaw<T extends object>(
  value: T
): T & { [RawSymbol]?: true } {
  def(value, ReactiveFlags.RAW, true)
  return value
}

/**
 * Mark an object so that shallowCopy uses strictCopy (preserving all
 * property descriptors including non-enumerable and symbol properties).
 *
 * By default, plain objects are copied with Object.keys only (fast path).
 * Use markStrict when a plain object has non-enumerable properties that
 * must survive copy-on-write.
 */
export function markStrict<T extends object>(value: T): T {
  def(value, ReactiveFlags.STRICT, true)
  return value
}

export function isDraft(value: any): boolean {
  return !!value && !!value[ReactiveFlags.STATE]
}

export function toBase<T>(observed: T): T {
  const raw = toState(observed)
  return raw ? toBase(raw.base as any) : observed
}

export function isModified(draft: Drafted): boolean {
  return draft[ReactiveFlags.STATE].modified
}

export function toState<T>(observed: T): DraftState | undefined {
  return observed && (observed as Target)[ReactiveFlags.STATE]
}

export function latest<T extends DraftState>(
  state: T
): T extends MapDraftState
  ? AnyMap
  : T extends SetDraftState
  ? AnySet
  : T extends ObjectDraftState
  ? AnyObject
  : AnyObject {
  return state.copy || (state.base as any)
}

export function markUnchanged(draft: Drafted): void {
  const state = draft[ReactiveFlags.STATE]
  if (state) {
    state.modified = false
  }
}

export function markChanged(state: DraftState) {
  if (!state.modified) {
    state.modified = true
    if (state.parent) {
      markChanged(state.parent)
    }
  }
}
