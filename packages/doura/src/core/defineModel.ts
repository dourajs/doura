import {
  State,
  ActionOptions,
  ViewOptions,
  ObjectModel,
  ModelOptions,
  ModelThis,
  ViewThis,
} from './modelOptions'
import { InferQueryEntry, QueriesOption } from './queryTypes'

export type DefineModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
> = ModelOptions<S, A, V> & {} // BUG: {} is required

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
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions<S>,
  const Q extends QueriesOption<S> & {
    [K in keyof Q]: InferQueryEntry<Q[K], S, ModelThis<S, A, V, Q>>
  },
  M extends ObjectModel<S, A, V>,
>(
  modelOptions: M & {
    state: S
    actions?: A
    views?: V & ThisType<ViewThis<S, V>>
    queries?: Q & QueriesOption<S, ModelThis<S, A, V, Q>>
  } & ThisType<ModelThis<S, A, V, Q>>
): M & DefineModel<S, A, V>

// Overload 2: function model — mirrors overload 1 with Q-aware ThisType.
//
// Same pattern as overload 1, just wrapped in a `() => ...` factory: M
// captures the returned object literal (so ModelQueries can walk its
// queries downstream via the `Model extends () => infer R` branch), Q
// uses the same `const` + self-referential-mapped-type combo so
// function models that declare their own queries also get per-entry
// fn-driven inference alongside child composition via use().
export function defineModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions<S>,
  const Q extends QueriesOption<S> & {
    [K in keyof Q]: InferQueryEntry<Q[K], S, ModelThis<S, A, V, Q>>
  },
  M extends ObjectModel<S, A, V>,
>(
  modelOptions: () => M & {
    state: S
    actions?: A
    views?: V & ThisType<ViewThis<S, V>>
    queries?: Q & QueriesOption<S, ModelThis<S, A, V, Q>>
  } & ThisType<ModelThis<S, A, V, Q>>
): () => M & DefineModel<S, A, V>

// Implementation
export function defineModel(modelOptions: any): any {
  return modelOptions
}
