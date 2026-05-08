import {
  State,
  ActionOptions,
  ViewOptions,
  ObjectModel,
  ModelOptions,
  ModelThis,
  ViewThis,
  AnyObjectModel,
} from './modelOptions'
import { InferQueryEntry, QueriesOption } from './queryTypes'

export type DefineModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  Models extends readonly AnyObjectModel[] = [],
> = ModelOptions<S, A, V, Models> & {} // BUG: {} is required

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
//     the NoInfer-wrapped fields inside QuerySpec pick up fn's
//     inferred TArgs / TData for that specific entry.
// Together they give per-entry fn-driven inference on BARE object
// literals — no helper function needed at the call site.
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
  } & ThisType<ModelThis<S, A, V, Q, Models>>
): M & { name: N } & DefineModel<S, A, V, Models>

// Implementation
export function defineModel(modelOptions: any): any {
  return modelOptions
}
