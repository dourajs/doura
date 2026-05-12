import type { QueryHandle, QueryFetch } from 'doura'

// Re-export QueryHandle and QueryFetch from doura core
export type { QueryHandle, QueryFetch }

export interface UseQueryResult<TData, TSelected = TData> {
  data: TSelected | undefined
  error: unknown
  isLoading: boolean
  isPending: boolean
  isFetching: boolean
  isSuccess: boolean
  isError: boolean
  isStale: boolean
  isRefetching: boolean
  isPlaceholderData: boolean
  refetch: () => Promise<TData>
}

export interface QueryOverrides<TData, TSelected = TData> {
  enabled?: boolean | (() => boolean)
  staleTime?: number
  select?: (data: TData) => TSelected
  placeholderData?: TData | ((prev?: TData) => TData | undefined)
}

export interface UseQuery {
  // Overload: query with no args
  <TData, TSelected = TData>(
    queryHandle: QueryHandle<[], TData>,
    options?: QueryOverrides<TData, TSelected>
  ): UseQueryResult<TData, TSelected>

  <TData, TSelected = TData>(
    queryFetch: QueryFetch<[], TData>,
    options?: QueryOverrides<TData, TSelected>
  ): UseQueryResult<TData, TSelected>

  // Overload: query with args
  <TArgs extends readonly unknown[], TData, TSelected = TData>(
    queryHandle: QueryHandle<TArgs, TData>,
    args: NoInfer<TArgs>,
    options?: QueryOverrides<TData, TSelected>
  ): UseQueryResult<TData, TSelected>

  <TArgs extends readonly unknown[], TData, TSelected = TData>(
    queryFetch: QueryFetch<TArgs, TData>,
    args: NoInfer<TArgs>,
    options?: QueryOverrides<TData, TSelected>
  ): UseQueryResult<TData, TSelected>
}
