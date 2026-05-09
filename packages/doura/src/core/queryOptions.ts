import type { OnDataCtx, QueryCtx } from './queryTypes'

export type QueryArgsTuple = readonly unknown[]

export type QueryFunction<
  TArgs extends QueryArgsTuple = any[],
  TData = any,
  TThis = void,
> = (this: TThis, ctx: QueryCtx, ...args: TArgs) => Promise<TData>

export interface QueryOptions<
  S = any,
  TArgs extends QueryArgsTuple = any[],
  TData = any,
> {
  staleTime?: number
  onData?: (ctx: OnDataCtx<S, TArgs>, data: TData) => void
}

export interface NormalizedQuerySpec<
  TArgs extends QueryArgsTuple = any[],
  TData = any,
  S = any,
> {
  fn: (ctx: QueryCtx, ...args: TArgs) => Promise<TData>
  staleTime?: number
  onData?: (ctx: OnDataCtx<S, TArgs>, data: TData) => void
}

export type QueryOptionsForEntry<S, T> = T extends (
  this: any,
  ctx: QueryCtx,
  ...args: infer TArgs extends QueryArgsTuple
) => Promise<infer TData>
  ? QueryOptions<S, TArgs, TData>
  : QueryOptions<S>

export function decorateModelQueries(modelOptions: any): void {
  const queries = modelOptions?.queries
  if (!queries || typeof queries !== 'object') {
    return
  }

  for (const name of Object.keys(queries)) {
    const entry = queries[name]
    if (typeof entry === 'function') {
      queries[name] = { fn: entry }
    }
  }
}

export function isQuerySpecLike(value: unknown): value is NormalizedQuerySpec {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as NormalizedQuerySpec).fn === 'function'
  )
}

export function setDecoratedQueryOptions(
  modelOptions: any,
  name: string,
  options: QueryOptions
): void {
  const queries = modelOptions?.queries
  const spec = queries?.[name]
  if (!spec || typeof spec !== 'object') {
    return
  }

  Object.assign(spec, options)
}
