import type { QueryHandle, QueryHash } from './queryTypes'
import type { NormalizedQuerySpec } from './queryOptions'
import type { Model, ModelDefinition } from './modelOptions'

type QueryArgsTuple = readonly unknown[]
type MutableTuple<T extends QueryArgsTuple> = [...T]

export const DOURA_QUERY_HANDLE = Symbol.for('doura.queryHandle')
export const DOURA_QUERY_REF = Symbol.for('doura.queryRef')
export const DOURA_ACTION_REF = Symbol.for('doura.actionRef')

/** Internal query handle protocol shared by core and framework hooks.
 *  Exported for first-party adapters; not part of the user-facing API. */
export interface InternalQueryHandle<
  TArgs extends QueryArgsTuple = any[],
  TData = any,
> extends QueryHandle<TArgs, TData> {
  readonly _model: any // ModelInstance — typed as any to avoid circular import
  readonly _queryName: string
  readonly _spec: NormalizedQuerySpec<any, any>
  /** Runtime discriminator: true when the query's fn takes args. */
  readonly _hasArgs: boolean

  /** Compute the stable cache hash for a given args value. */
  computeHash(...args: MutableTuple<TArgs>): QueryHash
  /** Subscribe to cache changes for a specific args slot. Returns unsubscribe. */
  subscribe(args: readonly unknown[], listener: () => void): () => void
  /** Register a GC observer for the given args slot. */
  observe(...args: MutableTuple<TArgs>): void
  /** Unregister a GC observer. cleanup is called when gcTime elapses. */
  unobserve(args: readonly unknown[], cleanup: () => void): void
}

export interface InternalQueryFetch<
  TArgs extends QueryArgsTuple = any[],
  TData = any,
> {
  (...args: MutableTuple<TArgs>): Promise<TData>
  readonly [DOURA_QUERY_HANDLE]?: InternalQueryHandle<TArgs, TData>
}

export interface QueryDefinitionRef {
  readonly model: ModelDefinition<Model>
  readonly queryName: string
}

export interface ActionDefinitionRef {
  readonly model: ModelDefinition<Model>
  readonly actionName: string
}

export type InternalQueryDefinitionRef<
  TArgs extends QueryArgsTuple = any[],
  TData = any,
> = InternalQueryFetch<TArgs, TData> & {
  readonly [DOURA_QUERY_REF]?: QueryDefinitionRef
}

export type InternalActionDefinitionRef<TFn extends (...args: any[]) => any> =
  TFn & {
    readonly [DOURA_ACTION_REF]?: ActionDefinitionRef
  }
