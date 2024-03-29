import { warn } from '../warning'
import { AnyObject } from '../types'
import { invariant, isPlainObject, hasOwn } from '../utils'

export type StateObject = {
  [x: string]: any
}

export type State = StateObject

export type ActionOptions = Record<string, Function>

export type Params = any

export type ViewOptions<State = any> = Record<
  string,
  ((s: State, ...args: any[]) => any) | (() => any)
>

export type Actions<A> = A extends ActionOptions
  ? {
      [K in keyof A]: A[K]
    }
  : {}

export type Views<ViewOptions> = {
  [K in keyof ViewOptions]: ViewOptions[K] extends (...args: infer Args) => any
    ? Args extends [] | [s: any]
      ? ReturnType<ViewOptions[K]>
      : Args extends [s: any, ...extArgs: infer ExtArgs]
      ? (...args: ExtArgs) => ReturnType<ViewOptions[K]>
      : never
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

function validateObject(model: AnyObjectModel, prop: keyof AnyObjectModel) {
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
  invariant(hasOwn(model, 'state'), 'state is required')
  invariant(
    typeof model.state !== 'bigint' && typeof model.state !== 'symbol',
    'state can not be BigInt or Symbol'
  )

  validateObject(model, 'actions')
  validateObject(model, 'views')

  const keys = new Map<string, string>()
  checkConflictedKey('state', model, keys)
  checkConflictedKey('views', model, keys)

  keys.clear()
  checkConflictedKey('actions', model, keys)
}
