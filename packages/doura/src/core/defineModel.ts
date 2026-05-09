import {
  State,
  ActionOptions,
  ViewOptions,
  ObjectModel,
  ModelOptions,
  ModelThis,
  ViewThis,
  AnyObjectModel,
  StripIndexSignature,
  ModelChildren,
} from './modelOptions'
import {
  decorateModelQueries,
  QueryOptions,
  setDecoratedQueryOptions,
} from './queryOptions'
import type { QueryCtx } from './queryTypes'

export type DefineModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  Models extends readonly AnyObjectModel[] = [],
  Q extends Record<
    string,
    (this: any, ctx: QueryCtx, ...args: any[]) => Promise<any>
  > = Record<
    string,
    (this: any, ctx: QueryCtx, ...args: any[]) => Promise<any>
  >,
> = ModelOptions<S, A, V, Models, Q> & {} // BUG: {} is required

type IsAny<T> = 0 extends 1 & T ? true : false

type KnownStringKeys<T> =
  IsAny<T> extends true ? never : Extract<keyof StripIndexSignature<T>, string>

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

type ModelKeyConflicts<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  Q,
  Models extends readonly AnyObjectModel[],
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

type NoModelKeyConflicts<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  Q,
  Models extends readonly AnyObjectModel[],
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
// The param shape is inlined (not reused from ObjectModel<S,A,V>) so only
// ONE ThisType<...> is in the intersection — otherwise TS drops the
// Q-aware ThisType in favor of ObjectModel's baked-in ThisType<S,A,V>.
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
  const Models extends readonly AnyObjectModel[] = [],
  const Q extends Record<
    string,
    (
      this: ModelThis<S, A, V, Q, Models>,
      ctx: QueryCtx,
      ...args: any[]
    ) => Promise<any>
  > & {
    [K in keyof Q]: (
      this: ModelThis<S, A, V, Q, Models>,
      ctx: QueryCtx,
      ...args: any[]
    ) => Promise<any>
  } = {},
  M extends ObjectModel<S, A, V, Models> = ObjectModel<S, A, V, Models>,
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
        (
          this: ModelThis<S, A, V, Q, Models>,
          ctx: QueryCtx,
          ...args: any[]
        ) => Promise<any>
      >
  } & NoModelKeyConflicts<S, A, V, Q, Models> &
    ThisType<ModelThis<S, A, V, Q, Models>>,
  setup?: (ctx: {
    model: {
      setQueryOptions<K extends Extract<keyof Q, string>>(
        name: K,
        options: { staleTime?: number }
      ): void
    }
  }) => void
): M & { name: N }

// Implementation
export function defineModel(modelOptions: any, setup?: any): any {
  decorateModelQueries(modelOptions)
  if (setup) {
    setup({
      model: {
        setQueryOptions(name: string, options: QueryOptions) {
          setDecoratedQueryOptions(modelOptions, name, options)
        },
      },
    })
  }
  return modelOptions
}
