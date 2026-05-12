import type {
  State,
  ActionOptions,
  ViewOptions,
  Model,
  ModelThis,
  ViewThis,
  StripIndexSignature,
  ModelChildren,
  ModelDefinition,
} from './modelOptions'
import {
  decorateModelQueries,
  type QueryOptions,
  type QueryOptionsForEntry,
  setDecoratedQueryOptions,
} from './queryOptions'
import type { QueryCtx } from './queryTypes'
import { DOURA_ACTION_REF, DOURA_QUERY_REF } from './internalQueryTypes'
import { hasOwn } from '../utils'

// Keep the empty intersection so TypeScript materializes the inferred model
// options shape before it is wrapped in ModelDefinition.
export type DefineModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  Models extends readonly ModelDefinition[] = [],
  Q extends Record<
    string,
    (this: void, ctx: QueryCtx, ...args: any[]) => Promise<any>
  > = Record<
    string,
    (this: void, ctx: QueryCtx, ...args: any[]) => Promise<any>
  >,
> = Model<S, A, V, Models, Q> & {}

type IsAny<T> = 0 extends 1 & T ? true : false

type KnownStringKeys<T> =
  IsAny<T> extends true ? never : Extract<keyof StripIndexSignature<T>, string>

type ReservedDefinitionField = '$options'

type ConflictMessage<
  Type extends string,
  ConflictedType extends string,
  K,
> = K extends string
  ? `key "${K}" in "${Type}" is conflicted with the key in "${ConflictedType}"`
  : never

type KeyConflict<
  Type extends string,
  T,
  ConflictedType extends string,
  Conflicted,
> = ConflictMessage<
  Type,
  ConflictedType,
  Extract<KnownStringKeys<T>, KnownStringKeys<Conflicted>>
>

type ReservedKeyConflict<Type extends string, T> = ConflictMessage<
  Type,
  'reserved model definition fields',
  Extract<KnownStringKeys<T>, ReservedDefinitionField>
>

type ModelKeyConflicts<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  Q,
  Models extends readonly ModelDefinition[],
> =
  | KeyConflict<'models', ModelChildren<Models>, 'state', S>
  | KeyConflict<'views', V, 'state', S>
  | KeyConflict<'views', V, 'models', ModelChildren<Models>>
  | KeyConflict<'queries', Q, 'state', S>
  | KeyConflict<'queries', Q, 'models', ModelChildren<Models>>
  | KeyConflict<'queries', Q, 'views', V>
  | KeyConflict<'actions', A, 'state', S>
  | KeyConflict<'actions', A, 'models', ModelChildren<Models>>
  | KeyConflict<'actions', A, 'views', V>
  | KeyConflict<'actions', A, 'queries', Q>
  | ReservedKeyConflict<'queries', Q>
  | ReservedKeyConflict<'actions', A>

type NoModelKeyConflicts<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  Q,
  Models extends readonly ModelDefinition[],
> = [ModelKeyConflicts<S, A, V, Q, Models>] extends [never]
  ? {}
  : {
      readonly __doura_key_conflict__: ModelKeyConflicts<S, A, V, Q, Models>
    }

// Overload 1: object model.
//
// Both M and Q are inferred from the same user object:
//   - M captures the literal shape (so ModelQueries<ReturnType> can walk
//     the queries field key-by-key and produce typed handles downstream).
//   - Q is inferred independently from the queries field so ThisType can
//     reference it directly — going via QueriesOfModel<M> would evaluate
//     too late for the contextual typing of `this` inside actions.
//
// The param shape is inlined (not reused from Model<S,A,V>) so only
// ONE ThisType<...> is in the intersection — otherwise TS drops the
// Q-aware ThisType in favor of Model's baked-in ThisType<S,A,V>.
//
// Why `const Q` + self-referential constraint:
//   - `const Q` (TS 5.0+) keeps Q's literal shape narrow at the call
//     site (no widening to a generic query function), so downstream
//     ModelQueries<typeof model> can see each entry's fn signature.
//   - `Q extends { [K in keyof Q]: (ctx, ...args) => Promise<...> }` is a
//     self-referential constraint: TS captures Q from the literal,
//     then validates each entry against a freshly-resolved
//     query function type. That fresh resolution is what preserves fn's
//     inferred TArgs / TData for that specific entry.
// Together they preserve per-entry fn-driven inference while rejecting
// `{ fn }` object literals at the call site.
//
// `& Record<string, query function>` is kept so shorthand fn entries (bare
// `(ctx) => Promise<T>`) still get `ctx: QueryCtx` contextually typed.
export function defineModel<
  const N extends string,
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions<S>,
  const Models extends readonly ModelDefinition[] = [],
  const Q extends Record<
    string,
    (this: void, ctx: QueryCtx, ...args: any[]) => Promise<any>
  > & {
    [K in keyof Q]: (this: void, ctx: QueryCtx, ...args: any[]) => Promise<any>
  } = {},
  M extends Model<S, A, V, Models, Q> = Model<S, A, V, Models, Q>,
>(
  modelOptions: M & {
    name: N
    state: S
    models?: Models
    actions?: A
    views?: V & ThisType<ViewThis<S, V, Models>>
    queries?: Q &
      Record<
        string,
        (this: void, ctx: QueryCtx, ...args: any[]) => Promise<any>
      >
  } & NoModelKeyConflicts<S, A, V, Q, Models> &
    ThisType<ModelThis<S, A, V, Q, Models>>,
  setup?: (ctx: {
    model: {
      setQueryOptions<K extends Extract<keyof Q, string>>(
        name: K,
        options: QueryOptionsForEntry<ModelThis<S, A, V, Q, Models>, Q[K]>
      ): void
    }
  }) => void
): ModelDefinition<M & { name: N }>

// Implementation
export function defineModel(modelOptions: any, setup?: any): any {
  decorateModelQueries(modelOptions)
  assertNoModelKeyConflicts(modelOptions)
  if (setup) {
    setup({
      model: {
        setQueryOptions(name: string, options: QueryOptions) {
          setDecoratedQueryOptions(modelOptions, name, options)
        },
      },
    })
  }
  const modelDefinition = {}
  Object.defineProperty(modelDefinition, '$options', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: modelOptions,
  })
  defineModelReferences(modelDefinition, modelOptions)
  return modelDefinition
}

function cacheKey(cache: Map<string, string>, type: string, key: string): void {
  const conflictedType = cache.get(key)
  if (conflictedType) {
    throw new Error(
      `[Doura] key "${key}" in "${type}" is conflicted with the key in "${conflictedType}"`
    )
  }
  cache.set(key, type)
}

function cacheObjectKeys(
  cache: Map<string, string>,
  type: string,
  obj: unknown
): void {
  if (!obj || typeof obj !== 'object') {
    return
  }
  for (const key of Object.keys(obj)) {
    cacheKey(cache, type, key)
  }
}

function cacheModelKeys(cache: Map<string, string>, models: unknown): void {
  if (!Array.isArray(models)) {
    return
  }

  const names = new Set<string>()
  for (const model of models) {
    const name = (model as any)?.$options?.name
    if (typeof name !== 'string') {
      continue
    }
    if (names.has(name)) {
      throw new Error(`[Doura] model "${name}" is duplicated in "models"`)
    }
    names.add(name)
    cacheKey(cache, 'models', name)
  }
}

function assertNoModelKeyConflicts(modelOptions: any): void {
  const keys = new Map<string, string>()
  cacheObjectKeys(keys, 'state', modelOptions?.state)
  cacheModelKeys(keys, modelOptions?.models)
  cacheObjectKeys(keys, 'views', modelOptions?.views)
  cacheObjectKeys(keys, 'queries', modelOptions?.queries)
  cacheObjectKeys(keys, 'actions', modelOptions?.actions)
}

function defineModelReferences(modelDefinition: any, modelOptions: any): void {
  const queries = modelOptions?.queries
  if (queries && typeof queries === 'object') {
    for (const queryName of Object.keys(queries)) {
      const queryRef = () => {
        throw new Error(
          `Query "${queryName}" must be used with a model instance.`
        )
      }
      Object.defineProperty(queryRef, DOURA_QUERY_REF, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: { model: modelDefinition, queryName },
      })
      defineReference(modelDefinition, 'queries', queryName, queryRef)
    }
  }

  const actions = modelOptions?.actions
  if (actions && typeof actions === 'object') {
    for (const actionName of Object.keys(actions)) {
      const actionRef = () => {
        throw new Error(
          `Action "${actionName}" must be used with a model instance.`
        )
      }
      Object.defineProperty(actionRef, DOURA_ACTION_REF, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: { model: modelDefinition, actionName },
      })
      defineReference(modelDefinition, 'actions', actionName, actionRef)
    }
  }
}

function defineReference(
  modelDefinition: any,
  type: 'actions' | 'queries',
  key: string,
  value: Function
): void {
  if (key === '$options') {
    throw new Error(
      `[Doura] key "$options" in "${type}" conflicts with reserved model definition field`
    )
  }
  if (hasOwn(modelDefinition, key)) {
    return
  }
  Object.defineProperty(modelDefinition, key, {
    configurable: true,
    enumerable: true,
    writable: false,
    value,
  })
}
