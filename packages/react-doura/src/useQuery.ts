import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import type { QueryHandle, QueryCacheEntry } from 'doura'
import { computeQueryHash, computeArgsKey } from 'doura'
import type { QueryOverrides, UseQueryResult } from './queryTypes'

// Overload: query with no args (TArgs = void)
export function useQuery<TData, TSelected = TData>(
  queryHandle: QueryHandle<void, TData>,
  options?: QueryOverrides<TData, TSelected>
): UseQueryResult<TData, TSelected>

// Overload: query with args
export function useQuery<TArgs extends object, TData, TSelected = TData>(
  queryHandle: QueryHandle<TArgs, TData>,
  args: TArgs,
  options?: QueryOverrides<TData, TSelected>
): UseQueryResult<TData, TSelected>

export function useQuery(
  queryHandle: QueryHandle<any, any>,
  argsOrOptions?: any,
  maybeOptions?: any
): UseQueryResult<any, any> {
  // --- Resolve overloaded args ---
  // Heuristic: if second arg looks like QueryOverrides (known option keys) and
  // third arg is absent, treat second arg as options for a void-args query.
  let args: any
  let options: QueryOverrides<any, any> | undefined
  if (
    maybeOptions === undefined &&
    argsOrOptions !== undefined &&
    argsOrOptions !== null &&
    typeof argsOrOptions === 'object' &&
    ('enabled' in argsOrOptions ||
      'staleTime' in argsOrOptions ||
      'select' in argsOrOptions ||
      'placeholderData' in argsOrOptions) &&
    // The query args variant would typically have a domain key like `id`;
    // we only treat as options when NO args-shaped keys are present besides
    // options keys. For safety, if the object has ONLY option keys, treat
    // as options. Mixed shapes fall through to args.
    Object.keys(argsOrOptions).every((k) =>
      ['enabled', 'staleTime', 'select', 'placeholderData'].includes(k)
    )
  ) {
    args = undefined
    options = argsOrOptions
  } else {
    args = argsOrOptions
    options = maybeOptions
  }

  const modelPublic = queryHandle._model
  const queryName = queryHandle._queryName
  // ModelPublicInstance proxies '_' to the ModelInternal instance
  const internal: any = (modelPublic as any)._
  const coordinator: any = internal._coordinator

  // Stable hash — used as dep key so subscribe/effect don't re-fire on
  // args object identity changes that produce the same cache key.
  const hash = computeQueryHash(
    internal.name,
    queryName,
    computeArgsKey(args, queryHandle._spec.key)
  )

  // Latest args via ref so refetch() always uses the current value without
  // forcing the callback identity to change on every render.
  const argsRef = useRef(args)
  argsRef.current = args

  const subscribe = useCallback(
    (cb: () => void) => internal.subscribeQuery(queryName, argsRef.current, cb),
    [internal, queryName, hash]
  )

  const getSnapshot = useCallback(
    () =>
      internal.getQueryState(queryName, argsRef.current) as
        | QueryCacheEntry
        | undefined,
    [internal, queryName, hash]
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

  // Fetch + GC lifecycle
  useEffect(() => {
    if (!coordinator) return
    coordinator.observeQuery(hash)

    if (enabled) {
      const stale = coordinator.isStale(
        internal,
        queryName,
        argsRef.current,
        options?.staleTime
      )
      if (stale) {
        coordinator.fetch(internal, queryName, argsRef.current).catch(() => {
          // Error surfaces via cacheEntry.error; swallow the rejection
          // to avoid unhandled promise warnings.
        })
      }
    }

    return () => {
      coordinator.unobserveQuery(hash, () => {
        internal._removeQuery(queryName, argsRef.current)
      })
    }
  }, [hash, enabled, coordinator, internal, queryName, options?.staleTime])

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
    if (!coordinator) return Promise.resolve(undefined)
    return coordinator.fetch(internal, queryName, argsRef.current)
  }, [coordinator, internal, queryName, hash])

  const isStale = coordinator
    ? coordinator.isStale(
        internal,
        queryName,
        argsRef.current,
        options?.staleTime
      )
    : true

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
