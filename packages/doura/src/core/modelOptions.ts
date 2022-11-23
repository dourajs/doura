import { DefineModel } from './defineModel'
import { warn } from '../warning'
import { EmptyObject } from '../types'
import { invariant, isPlainObject } from '../utils'

export type StateObject = {
  [x: string]: any
}

export type StatePrimitive =
  | String
  | Number
  | Boolean
  | any[]
  | undefined
  | null

export type State = StateObject | StatePrimitive

export type ActionOptions = Record<string, Function>

export type ViewOptions<State = any> = Record<
  string,
  ((s: State) => any) | (() => any)
>

export type Models = Record<string, AnyModel>

type FilterActionIndex<T> = {
  [P in keyof T as string extends P
    ? never
    : number extends P
    ? never
    : P]: T[P]
}

export type Actions<A> = A extends ActionOptions
  ? FilterActionIndex<A> extends infer FilterA
    ? {
        [K in keyof FilterA]: FilterA[K]
      }
    : {}
  : {}

export type Views<ViewOptions> = {
  [K in keyof ViewOptions]: ViewOptions[K] extends (...args: any) => any
    ? ReturnType<ViewOptions[K]>
    : never
}

export type ActionThis<
  S extends State = {},
  A extends ActionOptions = {},
  V extends ViewOptions = {},
  M extends Models = {}
> = {
  $state: S
  $patch: (s: StateObject) => void
} & S &
  Views<V> & {
    $models: {
      [K in keyof M]: M[K] extends DefineModel<
        any,
        infer DS,
        infer DA,
        infer DV,
        infer DM
      >
        ? ActionThis<DS, DA, DV, DM>
        : ActionThis
    }
  } & Actions<A>

export type ViewThis<
  S extends State = {},
  V extends ViewOptions = {},
  M extends Models = {}
> = S & {
  $state: S
  $isolate: <T>(fn: (s: S) => T) => T
} & Views<V> & {
    $models: {
      [K in keyof M]: M[K] extends DefineModel<
        any,
        infer DS,
        any,
        infer DV,
        infer DDeps
      >
        ? ViewThis<DS, DV, DDeps>
        : ViewThis
    }
  }

export type ModelOptions<
  N extends string,
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  M extends Models
> = {
  name?: N
  state: S
  actions?: A & ThisType<ActionThis<S, A, V, M>>
  views?: V & ThisType<ViewThis<S, V, M>>
  models?: M
}

export interface NamedModelOptions<
  N extends string,
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  M extends Models
> extends ModelOptions<N, S, A, V, M> {
  name: N
}

export type AnyModel = ModelOptions<any, any, any, any, any>

export type GetModelName<T> = T extends ModelOptions<
  infer Name,
  any,
  any,
  any,
  any
>
  ? Name
  : never

export type GetModelState<Model> = Model extends ModelOptions<
  any,
  infer S,
  any,
  any,
  any
>
  ? { [K in keyof S]: S[K] }
  : never

export type GetModelActions<Model> = Model extends ModelOptions<
  any,
  any,
  infer A,
  any,
  any
>
  ? Actions<A> & EmptyObject
  : never

export type GetModelViews<Model> = Model extends ModelOptions<
  any,
  any,
  any,
  infer V,
  any
>
  ? Views<V> & EmptyObject & { ttt: number }
  : never

export type GetModelDeps<T> = T extends ModelOptions<
  any,
  any,
  any,
  any,
  infer ModelOptions
>
  ? ModelOptions
  : never

/**
 * Checks if a parameter is a valid function but only when it's defined.
 * Otherwise, always returns true.
 */
export const ifDefinedIsFunction = <T>(func: T): boolean =>
  !func || typeof func === 'function'

function validateProperty(model: AnyModel, prop: keyof AnyModel, type: string) {
  const target = model[prop] as any
  if (target) {
    invariant(isPlainObject(target), `model.${prop} should be object!`)
  }
}

function checkConflictedKey(
  type: keyof AnyModel,
  obj: AnyModel,
  cache: Map<string, string>
) {
  if (!obj[type]) {
    return
  }

  for (const key of Object.keys(obj[type])) {
    if (cache.has(key)) {
      const conflictedType = cache.get(key)
      warn(
        `key "${key}" in "${type}" is conflicted with the key in "${conflictedType}"`
      )
    } else {
      cache.set(key, type)
    }
  }
}

export const validateModelOptions = (model: AnyModel): void => {
  invariant(model.hasOwnProperty('state'), 'state is required')
  invariant(
    typeof model.state !== 'bigint' && typeof model.state !== 'symbol',
    'state can not be BigInt or Symbol'
  )
  validateProperty(model, 'actions', 'object')
  validateProperty(model, 'views', 'object')

  const keys = new Map<string, string>()
  checkConflictedKey('state', model, keys)
  checkConflictedKey('views', model, keys)

  keys.clear()
  checkConflictedKey('actions', model, keys)
}
