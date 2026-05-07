// Re-export QueryHandle from doura core (produced by model.getApi())
export type { QueryHandle } from 'doura'

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
