import { AnyObject, AnySet, AnyMap } from '../types'
import { shallowCopy, toRawType, def } from '../utils'
import {
  DraftState,
  ObjectDraftState,
  MapDraftState,
  SetDraftState,
} from './draft'

export declare const RawSymbol: unique symbol

export const enum ReactiveFlags {
  SKIP = '__r_skip',
  IS_REACTIVE = '__r_isReactive',
  STATE = '__r_state',
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.STATE]?: DraftState
}

export type Drafted = {
  [ReactiveFlags.STATE]: DraftState
}

export const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  SET = 2,
  MAP = 3,
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Set':
    case 'WeakSet':
      return TargetType.SET
    case 'Map':
    case 'WeakMap':
      return TargetType.MAP
    default:
      return TargetType.INVALID
  }
}

export function getTargetType(value: Target) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}

export function isReactive(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

export function markRaw<T extends object>(
  value: T
): T & { [RawSymbol]?: true } {
  def(value, ReactiveFlags.SKIP, true)
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

export function prepareCopy(state: { base: any; copy: any }) {
  if (!state.copy) {
    state.copy = shallowCopy(state.base)
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
