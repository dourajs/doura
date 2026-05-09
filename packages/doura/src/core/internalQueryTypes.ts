import type { QueryHandle, QueryHash } from './queryTypes'
import type { NormalizedQuerySpec } from './queryOptions'

type QueryArgsTuple = readonly unknown[]
type MutableTuple<T extends QueryArgsTuple> = [...T]

/** Internal query handle protocol shared by core and framework hooks.
 *  This file is intentionally not re-exported from the public package entry. */
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
