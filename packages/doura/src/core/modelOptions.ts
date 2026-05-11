import { warn } from '../warning'
import type { AnyObject } from '../types'
import { invariant, isPlainObject, hasOwn, isArray } from '../utils'
import type { QueryCtx, QueryFetch, QueryHandle } from './queryTypes'
import { isQuerySpecLike } from './queryOptions'
import type { ModelInstance } from './modelPublicInstance'

type ModelDefinitionLike = {
  readonly $options: any
}

declare const DOURA_MODEL_DEFINITION: unique symbol

export type State = {
  [x: string]: any
}

export type ActionOptions = Record<string, Function>

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
  [K in keyof ViewOptions]: ViewOptions[K] extends (...args: infer Args) => any
    ? Args extends [] | [s: any]
      ? ReturnType<ViewOptions[K]>
      : never
    : never
}

export interface ModelQueryMethods {
  $invalidateQueries(): void
  $cancelQueries(): void
  $resetQueries(): void
}

/** Map a raw queries options object (what the user writes under `queries`)
 *  to the handles that actually appear on `this` inside actions. */
type QueriesOnThis<Q> =
  Q extends Record<string, any>
    ? {
        readonly [K in keyof StripIndexSignatureUnlessAny<Q>]: HandleFromEntry<
          Q[K]
        >
      }
    : {}

type ModelName<ModelDef> = ModelDef extends { readonly $options: infer M }
  ? RawModelName<M>
  : never

export type ModelChildren<Models> = Models extends readonly unknown[]
  ? {
      readonly [ModelDef in Models[number] as ModelName<ModelDef>]: ModelDef extends ModelDefinition<Model>
        ? ModelInstance<ModelDef>
        : never
    }
  : {}

type ModelViewState<ModelDef> = ModelDef extends { readonly $options: infer M }
  ? M extends { state: infer S }
    ? S extends State
      ? S
      : {}
    : {}
  : {}

type ModelViewViews<ModelDef> = ModelDef extends { readonly $options: infer M }
  ? M extends { views: infer V }
    ? V extends ViewOptions
      ? V
      : {}
    : {}
  : {}

type ModelViewModels<ModelDef> = ModelDef extends { readonly $options: infer M }
  ? M extends { models: infer Models }
    ? Models extends readonly unknown[]
      ? Models
      : []
    : []
  : []

type ModelViewThis<ModelDef> = ViewThis<
  ModelViewState<ModelDef>,
  ModelViewViews<ModelDef>,
  ModelViewModels<ModelDef>
>

export type ViewModelChildren<Models> = Models extends readonly unknown[]
  ? {
      readonly [ModelDef in Models[number] as ModelName<ModelDef>]: ModelViewThis<ModelDef>
    }
  : {}

type RawModelName<M> = M extends { name: infer N }
  ? N extends string
    ? N
    : never
  : never

type RawModelChildren<Models> = Models extends readonly unknown[]
  ? {
      readonly [ModelDef in Models[number] as ModelDef extends {
        readonly $options: infer M
      }
        ? RawModelName<M>
        : never]: ModelDef extends ModelDefinition<Model>
        ? ModelInstance<ModelDef>
        : never
    }
  : {}

type RawViewModelChildren<Models> = Models extends readonly unknown[]
  ? {
      readonly [ModelDef in Models[number] as ModelDef extends {
        readonly $options: infer M
      }
        ? RawModelName<M>
        : never]: ModelViewThis<ModelDef>
    }
  : {}

export type ModelStateFromModel<M extends Model> = M extends { state: infer S }
  ? { [K in keyof S]: S[K] }
  : never

export type ModelActionsFromModel<M extends Model> =
  M extends Model<any, infer A, any, any> ? Actions<A> : never

export type ModelViewsFromModel<M extends Model> =
  M extends Model<any, any, infer V, any> ? Views<V> : never

export type ModelModelsFromModel<M extends Model> = M extends {
  models: infer Models
}
  ? RawModelChildren<Models>
  : {}

type ModelQueriesFromEntries<Q> =
  Q extends Record<string, any>
    ? {
        readonly [K in keyof StripIndexSignatureUnlessAny<Q>]: HandleFromEntry<
          Q[K]
        >
      }
    : {}

export type ModelQueriesFromModel<M extends Model> = M extends {
  queries: infer Q
}
  ? ModelQueriesFromEntries<Q>
  : {}

export type ModelQueryFetchesFromModel<M extends Model> = M extends {
  queries: infer Q
}
  ? QueryFetchesFromEntries<Q>
  : {}

type UnwrapDef<ModelDef extends ModelDefinition> =
  ModelDef extends ModelDefinition<infer M> ? M : never

type ModelStateFromDef<ModelDef extends ModelDefinition> = ModelStateFromModel<
  UnwrapDef<ModelDef>
>

type ModelActionsFromDef<ModelDef extends ModelDefinition> =
  ModelActionsFromModel<UnwrapDef<ModelDef>>

type ModelViewsFromDef<ModelDef extends ModelDefinition> = ModelViewsFromModel<
  UnwrapDef<ModelDef>
>

type ModelModelsFromDef<ModelDef extends ModelDefinition> =
  ModelModelsFromModel<UnwrapDef<ModelDef>>

type ModelQueriesFromDef<ModelDef extends ModelDefinition> =
  ModelQueriesFromModel<UnwrapDef<ModelDef>>

type ModelQueryFetchesFromDef<ModelDef extends ModelDefinition> =
  ModelQueryFetchesFromModel<UnwrapDef<ModelDef>>

export type ModelThis<
  S extends State = {},
  A extends ActionOptions = {},
  V extends ViewOptions = {},
  Q = {},
  Models extends readonly ModelDefinition[] = [],
> = {
  $state: S
  $patch: (s: AnyObject) => void
  $queries: QueriesOnThis<Q>
} & StripIndexSignatureUnlessAny<S> &
  StripIndexSignatureUnlessAny<Views<V>> &
  StripIndexSignatureUnlessAny<Actions<A>> &
  StripIndexSignatureUnlessAny<QueryFetchesFromEntries<Q>> &
  StripIndexSignatureUnlessAny<RawModelChildren<Models>> &
  ModelQueryMethods

export type ViewThis<
  S extends State = {},
  V extends ViewOptions = {},
  Models extends readonly ModelDefinition[] = [],
> = S & {
  $state: S
  $isolate: <T>(fn: (s: S) => T) => T
} & Views<V> &
  RawViewModelChildren<Models>

export type Model<
  S extends State = State,
  A extends ActionOptions = ActionOptions,
  V extends ViewOptions = ViewOptions,
  Models extends
    readonly ModelDefinitionLike[] = readonly ModelDefinitionLike[],
  Q extends Record<
    string,
    (this: void, ctx: QueryCtx, ...args: any[]) => Promise<any>
  > = Record<
    string,
    (this: void, ctx: QueryCtx, ...args: any[]) => Promise<any>
  >,
> = {
  name: string
  state: S
  actions?: A
  views?: V & ThisType<ViewThis<S, V, Models>>
  queries?: Q
  models?: Models
} & ThisType<ModelThis<S, A, V, Q, Models>>

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

type StripIndexSignatureUnlessAny<T> = 0 extends 1 & T
  ? T
  : StripIndexSignature<T>

type ModelDefinitionActionRefs<M extends Model> = M extends {
  actions?: infer A
}
  ? A extends ActionOptions
    ? StripIndexSignatureUnlessAny<A>
    : {}
  : {}

type ModelDefinitionQueryRefs<M extends Model> = M extends { queries?: infer Q }
  ? Q extends Record<string, any>
    ? {
        readonly [K in keyof StripIndexSignatureUnlessAny<Q> as K extends keyof ModelDefinitionActionRefs<M>
          ? never
          : K]: QueryFetchFromEntry<Q[K]>
      }
    : {}
  : {}

export type ModelDefinition<
  M extends Model = Model<any, any, any, readonly ModelDefinitionLike[], any>,
> = {
  readonly $options: M
  readonly [DOURA_MODEL_DEFINITION]: true
} & ModelDefinitionActionRefs<M> &
  ModelDefinitionQueryRefs<M>

export type ModelState<ModelDef extends ModelDefinition> =
  ModelStateFromDef<ModelDef>

export type ModelActions<ModelDef extends ModelDefinition> =
  ModelActionsFromDef<ModelDef>

export type ModelViews<ModelDef extends ModelDefinition> =
  ModelViewsFromDef<ModelDef>

export type ModelModels<ModelDef extends ModelDefinition> =
  ModelModelsFromDef<ModelDef>

export type ModelQueries<ModelDef extends ModelDefinition> =
  ModelQueriesFromDef<ModelDef>

export type ModelQueryFetches<ModelDef extends ModelDefinition> =
  ModelQueryFetchesFromDef<ModelDef>

/** Infer (TArgs, TData) from a user-provided query function, then surface
 *  them as a QueryHandle. */
type HandleFromEntry<T> = T extends (
  this: any,
  ctx: QueryCtx,
  ...args: infer A
) => Promise<infer D>
  ? QueryHandle<A, D>
  : QueryHandle<any, any>

type QueryFetchFromEntry<T> = T extends (
  this: any,
  ctx: QueryCtx,
  ...args: infer A
) => Promise<infer D>
  ? QueryFetch<A, D>
  : QueryFetch<any, any>

type QueryFetchesFromEntries<Q> =
  Q extends Record<string, any>
    ? {
        readonly [K in keyof StripIndexSignatureUnlessAny<Q>]: QueryFetchFromEntry<
          Q[K]
        >
      }
    : {}

function validateObject(model: Model, prop: string) {
  const target = (model as any)[prop] as any
  if (target) {
    invariant(isPlainObject(target), `model.${prop} should be object!`)
  }
}

function validateQueries(model: Model) {
  const queries = (model as any).queries
  if (!queries) return
  invariant(isPlainObject(queries), `model.queries should be object!`)
  for (const key of Object.keys(queries)) {
    const spec = queries[key]
    if (!isQuerySpecLike(spec)) {
      warn(
        `query "${key}" must be a function. Configure query options with defineModel(..., setup).`
      )
    }
  }
}

function validateModels(model: Model) {
  const models = (model as any).models
  if (!models) return
  invariant(isArray(models), `model.models should be array!`)

  for (const child of models) {
    const childOptions = child?.$options
    invariant(
      childOptions &&
        typeof childOptions.name === 'string' &&
        childOptions.name.length > 0,
      'model name is required in model options'
    )
  }
}

export const validateModelOptions = (model: Model): void => {
  invariant(
    typeof model.name === 'string' && model.name.length > 0,
    'model name is required in model options'
  )
  invariant(hasOwn(model, 'state'), 'state is required')
  invariant(
    typeof model.state !== 'bigint' && typeof model.state !== 'symbol',
    'state can not be BigInt or Symbol'
  )

  validateObject(model, 'actions')
  validateObject(model, 'views')
  validateQueries(model)
  validateModels(model)
}
