import { warn } from '../warning'
import { AnyObject } from '../types'
import { invariant, isPlainObject } from '../utils'

export type StateObject = {
  [x: string]: any
}

export type State = StateObject

export type ActionOptions = Record<string, Function>

export type Params = any

export type ViewOptions<State = any> = Record<
  string,
  ((s: State) => any) | (() => any)
>

export type Actions<A> = A extends ActionOptions
  ? {
      [K in keyof A]: A[K]
    }
  : {}

export type Views<ViewOptions> = {
  [K in keyof ViewOptions]: ViewOptions[K] extends (...args: any) => any
    ? ReturnType<ViewOptions[K]>
    : never
}

export type ModelThis<
  S extends State = {},
  A extends ActionOptions = {},
  V extends ViewOptions = {}
> = {
  $state: S
  $patch: (s: AnyObject) => void
} & S &
  Views<V> &
  Actions<A>

export type ViewThis<S extends State = {}, V extends ViewOptions = {}> = S & {
  $state: S
  $isolate: <T>(fn: (s: S) => T) => T
} & Views<V>

export type ObjectModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions
> = {
  state: S
  actions?: A
  views?: V & ThisType<ViewThis<S, V>>
} & ThisType<ModelThis<S, A, V>>

export interface FunctionModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions
> {
  (): ObjectModel<S, A, V>
}

export type ModelOptions<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  P extends Params
> = ObjectModel<S, A, V> | FunctionModel<S, A, V>

export type AnyObjectModel = ObjectModel<any, any, any>

export type AnyFunctionModel = FunctionModel<any, any, any>

export type AnyModel = AnyObjectModel | AnyFunctionModel

export type ModelState<Model> = Model extends ModelOptions<
  infer S,
  any,
  any,
  any
>
  ? { [K in keyof S]: S[K] }
  : never

export type ModelActions<Model> = Model extends ModelOptions<
  any,
  infer A,
  any,
  any
>
  ? Actions<A>
  : never

export type ModelViews<Model> = Model extends ModelOptions<
  any,
  any,
  infer V,
  any
>
  ? Views<V>
  : never

/**
 * Checks if a parameter is a valid function but only when it's defined.
 * Otherwise, always returns true.
 */
export const ifDefinedIsFunction = <T>(func: T): boolean =>
  !func || typeof func === 'function'

function validateProperty(
  model: AnyObjectModel,
  prop: keyof AnyObjectModel,
  type: string
) {
  const target = model[prop] as any
  if (target) {
    invariant(isPlainObject(target), `model.${prop} should be object!`)
  }
}

function checkConflictedKey(
  type: keyof AnyObjectModel,
  obj: AnyObjectModel,
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

export const validateModelOptions = (model: AnyObjectModel): void => {
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
