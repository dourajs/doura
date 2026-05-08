import { warn } from '../warning'
import { AnyObject } from '../types'
import { invariant, isPlainObject, hasOwn } from '../utils'
import { QueriesOption, QueryCtx, QueryHandle } from './queryTypes'

export type State = {
  [x: string]: any
}

export type ActionOptions = Record<string, Function>

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

/** Names of declared queries (string keys only). Falls back to `string`
 *  when Q is `any` so legacy / loose call sites still accept any name. */
type QueryNames<Q> = 0 extends 1 & Q
  ? string
  : keyof Q extends never
    ? string
    : Extract<keyof Q, string>

type QueryArgsTuple = readonly unknown[]

type MutableTuple<T extends QueryArgsTuple> = [...T]

type QueryArgsFromEntry<T> = T extends (
  this: any,
  ctx: QueryCtx,
  ...args: infer A
) => Promise<any>
  ? A
  : T extends {
        fn: (this: any, ctx: QueryCtx, ...args: infer A) => Promise<any>
      }
    ? A
    : any[]

type QueryDataFromEntry<T> = T extends (
  this: any,
  ctx: QueryCtx,
  ...args: any[]
) => Promise<infer D>
  ? D
  : T extends {
        fn: (this: any, ctx: QueryCtx, ...args: any[]) => Promise<infer D>
      }
    ? D
    : unknown

type QueryArgsFor<Q, N> = 0 extends 1 & Q
  ? any[]
  : N extends keyof Q
    ? QueryArgsFromEntry<Q[N]>
    : any[]

type QueryDataFor<Q, N> = 0 extends 1 & Q
  ? unknown
  : N extends keyof Q
    ? QueryDataFromEntry<Q[N]>
    : unknown

type NameArgsParam<TArgs extends QueryArgsTuple> = TArgs extends []
  ? [args?: []]
  : [args: MutableTuple<TArgs>]

type NameArgsOptional<TArgs extends QueryArgsTuple> =
  | []
  | [args: MutableTuple<TArgs>]

type NameSetDataParam<TArgs extends QueryArgsTuple, TData> = TArgs extends []
  ? [args: [], data: TData]
  : [args: MutableTuple<TArgs>, data: TData]

export interface ModelQueryMethods<Q = {}> {
  $invalidateQueries<N extends QueryNames<Q>>(
    queryName?: N,
    ...args: NameArgsOptional<QueryArgsFor<Q, N>>
  ): void
  $cancelQueries<N extends QueryNames<Q>>(
    queryName?: N,
    ...args: NameArgsOptional<QueryArgsFor<Q, N>>
  ): void
  $resetQueries<N extends QueryNames<Q>>(
    queryName?: N,
    ...args: NameArgsOptional<QueryArgsFor<Q, N>>
  ): void
  $setQueryData<N extends QueryNames<Q>>(
    queryName: N,
    ...args: NameSetDataParam<QueryArgsFor<Q, N>, QueryDataFor<Q, N>>
  ): void
  $getQueryData<N extends QueryNames<Q>>(
    queryName: N,
    ...args: NameArgsParam<QueryArgsFor<Q, N>>
  ): QueryDataFor<Q, N> | undefined
  $prefetchQuery<N extends QueryNames<Q>>(
    queryName: N,
    ...args: NameArgsParam<QueryArgsFor<Q, N>>
  ): Promise<void>
}

/** Map a raw queries options object (what the user writes under `queries`)
 *  to the handles that actually appear on `this` inside actions. */
type QueriesOnThis<Q> =
  Q extends Record<string, any>
    ? { readonly [K in keyof Q]: HandleFromEntry<Q[K]> }
    : {}

export type ModelThis<
  S extends State = {},
  A extends ActionOptions = {},
  V extends ViewOptions = {},
  Q = {},
> = {
  $state: S
  $patch: (s: AnyObject) => void
} & S &
  Views<V> &
  Actions<A> &
  QueriesOnThis<Q> &
  ModelQueryMethods<Q>

export type ViewThis<S extends State = {}, V extends ViewOptions = {}> = S & {
  $state: S
  $isolate: <T>(fn: (s: S) => T) => T
} & Views<V>

export type ObjectModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
> = {
  state: S
  actions?: A
  views?: V & ThisType<ViewThis<S, V>>
  queries?: QueriesOption<S>
} & ThisType<ModelThis<S, A, V>>

export interface FunctionModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
> {
  (): ObjectModel<S, A, V>
}

export type ModelOptions<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
> = ObjectModel<S, A, V> | FunctionModel<S, A, V>

export type AnyObjectModel = ObjectModel<any, any, any>

export type AnyFunctionModel = FunctionModel<any, any, any>

export type AnyModel = AnyObjectModel | AnyFunctionModel

/** Strip index signatures, keeping only known literal keys */
export type StripIndexSignature<T> = {
  [K in keyof T as string extends K
    ? never
    : number extends K
      ? never
      : symbol extends K
        ? never
        : K]: T[K]
}

export type ModelState<Model> =
  Model extends ModelOptions<infer S, any, any>
    ? { [K in keyof S]: S[K] }
    : never

export type ModelActions<Model> =
  Model extends ModelOptions<any, infer A, any> ? Actions<A> : never

export type ModelViews<Model> =
  Model extends ModelOptions<any, any, infer V> ? Views<V> : never

/** Infer (TArgs, TData) from a user-provided query entry (shorthand fn or
 *  full spec object), then surface them as a QueryHandle. */
type HandleFromEntry<T> = T extends (
  this: any,
  ctx: QueryCtx,
  ...args: infer A
) => Promise<infer D>
  ? QueryHandle<A, D>
  : T extends {
        fn: (this: any, ctx: QueryCtx, ...args: infer A) => Promise<infer D>
      }
    ? QueryHandle<A, D>
    : QueryHandle<any, any>

/** Extract the queries type from a model definition as QueryHandle refs. */
export type ModelQueries<Model> = Model extends { queries: infer Q }
  ? Q extends Record<string, any>
    ? { readonly [K in keyof Q]: HandleFromEntry<Q[K]> }
    : {}
  : Model extends () => infer R
    ? R extends { queries: infer Q2 }
      ? Q2 extends Record<string, any>
        ? { readonly [K in keyof Q2]: HandleFromEntry<Q2[K]> }
        : {}
      : {}
    : {}

function validateObject(model: AnyObjectModel, prop: string) {
  const target = (model as any)[prop] as any
  if (target) {
    invariant(isPlainObject(target), `model.${prop} should be object!`)
  }
}

function validateQueries(model: AnyObjectModel) {
  const queries = (model as any).queries
  if (!queries) return
  invariant(isPlainObject(queries), `model.queries should be object!`)
  for (const key of Object.keys(queries)) {
    const spec = queries[key]
    if (
      typeof spec !== 'function' &&
      !(isPlainObject(spec) && typeof spec.fn === 'function')
    ) {
      warn(
        `query "${key}" must be a function or an object with an "fn" property`
      )
      continue
    }

    if (isPlainObject(spec)) {
      if ('setData' in spec) {
        warn(
          `query "${key}" uses removed option "setData"; write state inside "fn"`
        )
      }
      if ('getData' in spec) {
        warn(
          `query "${key}" uses removed option "getData"; query reads now come from cache`
        )
      }
      if ('key' in spec) {
        warn(
          `query "${key}" uses removed option "key"; cache identity now comes from query args`
        )
      }
      if ('onData' in spec) {
        warn(
          `query "${key}" uses removed option "onData"; write state inside "fn"`
        )
      }
    }
  }
}

function checkConflictedKey(
  type: string,
  obj: AnyObjectModel,
  cache: Map<string, string>
) {
  if (!(obj as any)[type]) {
    return
  }

  for (const key of Object.keys((obj as any)[type])) {
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
  validateQueries(model)

  const keys = new Map<string, string>()
  checkConflictedKey('state', model, keys)
  checkConflictedKey('views', model, keys)
  checkConflictedKey('actions', model, keys)
  checkConflictedKey('queries', model, keys)
}
