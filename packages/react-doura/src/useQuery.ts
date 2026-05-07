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
  // Resolve overloaded args using the runtime tag rather than key-scanning.
  let args: any
  let options: QueryOverrides<any, any> | undefined
  if (queryHandle._hasArgs) {
    args = argsOrOptions
    options = maybeOptions
  } else {
    args = undefined
    options = argsOrOptions
  }

  const modelPublic = queryHandle._model
  const queryName = queryHandle._queryName
  // ModelPublicInstance proxies '_' to the ModelInternal instance
  const internal: any = (modelPublic as any)._
  const coordinator: any = internal.coordinator

  // Stable hash — memoized so subscribe/effect don't re-fire on
  // args object identity changes that produce the same cache key.
  const hash = useMemo(
    () =>
      computeQueryHash(
        internal.name,
        queryName,
        computeArgsKey(args, queryHandle._spec.key)
      ),
    [internal.name, queryName, args]
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
        queryHandle.reset(argsRef.current)
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

  // Derive isStale from the already-subscribed cacheEntry rather than
  // re-reading the cache (which recomputes the hash) every render.
  const resolvedStaleTime = coordinator
    ? coordinator.resolveStaleTime(internal, queryName, options?.staleTime)
    : 0
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
