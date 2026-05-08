import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import type { QueryHandle, QueryCacheEntry } from 'doura'
import type { QueryOverrides, UseQueryResult } from './queryTypes'

// Overload: query with no args
export function useQuery<TData, TSelected = TData>(
  queryHandle: QueryHandle<[], TData>,
  options?: QueryOverrides<TData, TSelected>
): UseQueryResult<TData, TSelected>

// Overload: query with args
export function useQuery<
  TArgs extends readonly unknown[],
  TData,
  TSelected = TData,
>(
  queryHandle: QueryHandle<TArgs, TData>,
  args: NoInfer<TArgs>,
  options?: QueryOverrides<TData, TSelected>
): UseQueryResult<TData, TSelected>

export function useQuery(
  queryHandle: QueryHandle<any, any>,
  argsOrOptions?: any,
  maybeOptions?: any
): UseQueryResult<any, any> {
  // Resolve overloaded args using the runtime tag rather than key-scanning.
  let args: readonly unknown[]
  let options: QueryOverrides<any, any> | undefined
  if (queryHandle._hasArgs) {
    args = argsOrOptions ?? []
    options = maybeOptions
  } else {
    args = []
    options = argsOrOptions
  }

  // Stable hash — computed from tuple contents so inline `[id]` arrays do
  // not re-subscribe when the hash is unchanged.
  const hash = queryHandle.computeHash(...(args as any[]))

  // Latest args via ref so refetch() always uses the current value without
  // forcing the callback identity to change on every render.
  const argsRef = useRef(args)
  argsRef.current = args

  const subscribe = useCallback(
    (cb: () => void) => queryHandle.subscribe(argsRef.current, cb),
    [queryHandle, hash]
  )

  const getSnapshot = useCallback(
    () =>
      queryHandle.getState(...(argsRef.current as any[])) as
        | QueryCacheEntry
        | undefined,
    [queryHandle, hash]
  )

  const cacheEntry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const data = cacheEntry?.data
  const error = cacheEntry?.error
  const fetchStatus = cacheEntry?.fetchStatus ?? 'idle'

  // Resolve enabled
  const enabled =
    options?.enabled !== undefined
      ? typeof options.enabled === 'function'
        ? options.enabled()
        : options.enabled
      : true

  // Resolved staleTime (hook override > spec > 0)
  const resolvedStaleTime =
    options?.staleTime ?? queryHandle._spec.staleTime ?? 0

  // Fetch + GC lifecycle
  useEffect(() => {
    const effectArgs = args
    queryHandle.observe(effectArgs)

    if (enabled) {
      const entry = queryHandle.getState(...(effectArgs as any[]))
      const stale =
        !entry ||
        entry.data === undefined ||
        Date.now() - entry.dataUpdatedAt >= resolvedStaleTime
      if (stale) {
        queryHandle.fetch(...(effectArgs as any[])).catch(() => {
          // Error surfaces via cacheEntry.error; swallow the rejection
          // to avoid unhandled promise warnings.
        })
      }
    }

    return () => {
      queryHandle.unobserve(effectArgs, () => {
        queryHandle.reset(...(effectArgs as any[]))
      })
    }
  }, [hash, enabled, queryHandle, resolvedStaleTime])

  // Apply select transform to real data (not placeholder)
  const selectedData = useMemo(() => {
    if (data === undefined) return undefined
    if (options?.select) return options.select(data)
    return data
  }, [data, options?.select])

  // Placeholder resolution — only used when real data is not yet present
  const hasData = data !== undefined
  const hasPlaceholder = !hasData && options?.placeholderData !== undefined

  const displayData = useMemo(() => {
    if (hasData) return selectedData
    if (options?.placeholderData !== undefined) {
      return typeof options.placeholderData === 'function'
        ? (options.placeholderData as (prev?: any) => any)(undefined)
        : options.placeholderData
    }
    return undefined
  }, [hasData, selectedData, options?.placeholderData])

  const hasError = error !== undefined && error !== null
  const isFetching = fetchStatus === 'fetching'
  const isLoading = !hasData && !hasError && enabled
  const isPending = !hasData

  const refetch = useCallback((): Promise<any> => {
    return queryHandle.fetch(...(argsRef.current as any[]))
  }, [queryHandle, hash])

  const isStale =
    !cacheEntry ||
    cacheEntry.data === undefined ||
    Date.now() - cacheEntry.dataUpdatedAt >= resolvedStaleTime

  return {
    data: displayData,
    error,
    isLoading,
    isPending,
    isFetching,
    isSuccess: hasData && !hasError,
    isError: hasError,
    isStale,
    isRefetching: hasData && isFetching,
    isPlaceholderData: hasPlaceholder,
    refetch,
  }
}
