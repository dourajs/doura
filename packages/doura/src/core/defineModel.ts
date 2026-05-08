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
import { InferQueryEntry, QueriesOption } from './queryTypes'

export type DefineModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  Models extends readonly AnyObjectModel[] = [],
> = ModelOptions<S, A, V, Models> & {} // BUG: {} is required

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
//     site (no widening to `QueryInputSpec<any, any>`), so downstream
//     ModelQueries<typeof model> can see each entry's fn signature.
//   - `Q extends { [K in keyof Q]: InferQueryEntry<Q[K], S, TThis> }` is a
//     self-referential constraint: TS captures Q from the literal,
//     then validates each entry against a freshly-resolved
//     `InferQueryEntry<Q[K], S, TThis>`. That fresh resolution is what lets
//     the branded QuerySpec returned by query() preserves fn's inferred
//     TArgs / TData for that specific entry.
// Together they preserve per-entry fn-driven inference for query(...) specs
// while rejecting unbranded `{ fn }` object literals at the call site.
//
// `& QueriesOption<S>` is kept so shorthand fn entries (bare
// `(ctx) => Promise<T>`) still get `ctx: QueryCtx` contextually typed.
export function defineModel<
  const N extends string,
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions<S>,
  const Models extends readonly AnyObjectModel[] = [],
  const Q extends QueriesOption<S> & {
    [K in keyof Q]: InferQueryEntry<Q[K], S, ModelThis<S, A, V, Q, Models>>
  } = {},
  M extends ObjectModel<S, A, V, Models> = ObjectModel<S, A, V, Models>,
>(
  modelOptions: M & {
    name: N
    state: S
    models?: Models
    actions?: A
    views?: V & ThisType<ViewThis<S, V, Models>>
    queries?: Q & QueriesOption<S, ModelThis<S, A, V, Q, Models>>
  } & NoModelKeyConflicts<S, A, V, Q, Models> &
    ThisType<ModelThis<S, A, V, Q, Models>>
): M & { name: N }

// Implementation
export function defineModel(modelOptions: any): any {
  return modelOptions
}
