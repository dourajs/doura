import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import type { QueryHandle, QueryCacheEntry } from 'doura'
import type { InternalQueryHandle } from '../../doura/src/core/internalQueryTypes'
import type { QueryOverrides, UseQueryResult } from './queryTypes'

function shallowArrayEqual(
  a: readonly unknown[] | undefined,
  b: readonly unknown[]
): boolean {
  if (a === b) return true
  if (!a || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false
  }
  return true
}

function isCacheEntryStale(
  entry: QueryCacheEntry | undefined,
  staleTime: number
): boolean {
  return (
    !entry ||
    entry.data === undefined ||
    Date.now() - entry.dataUpdatedAt >= staleTime
  )
}

function useQueryHash(
  queryHandle: InternalQueryHandle<any, any>,
  args: readonly unknown[]
): string {
  const cacheRef = useRef<{
    queryHandle: InternalQueryHandle<any, any>
    args: readonly unknown[]
    hash: string
  }>()

  const cached = cacheRef.current
  if (
    !cached ||
    cached.queryHandle !== queryHandle ||
    !shallowArrayEqual(cached.args, args)
  ) {
    const next = {
      queryHandle,
      args: [...args],
      hash: queryHandle.computeHash(...(args as any[])),
    }
    cacheRef.current = next
    return next.hash
  }

  return cached.hash
}

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
  const queryHandleInternal = queryHandle as InternalQueryHandle<any, any>

  // Resolve overloaded args using the runtime tag rather than key-scanning.
  let args: readonly unknown[]
  let options: QueryOverrides<any, any> | undefined
  if (queryHandleInternal._hasArgs) {
    args = argsOrOptions ?? []
    options = maybeOptions
  } else {
    args = []
    options = argsOrOptions
  }

  // Stable hash — cached by tuple contents so inline `[id]` arrays do not
  // recompute or re-subscribe when the args are unchanged.
  const hash = useQueryHash(queryHandleInternal, args)

  // Latest args via ref so refetch() always uses the current value without
  // forcing the callback identity to change on every render.
  const argsRef = useRef(args)
  argsRef.current = args

  const subscribe = useCallback(
    (cb: () => void) => queryHandleInternal.subscribe(argsRef.current, cb),
    [queryHandleInternal, hash]
  )

  const getSnapshot = useCallback(
    () =>
      queryHandleInternal.getState(...(argsRef.current as any[])) as
        | QueryCacheEntry
        | undefined,
    [queryHandleInternal, hash]
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
    options?.staleTime ?? queryHandleInternal._spec.staleTime ?? 0

  // Fetch + GC lifecycle
  useEffect(() => {
    const effectArgs = args
    queryHandleInternal.observe(effectArgs)

    if (enabled) {
      const entry = queryHandleInternal.getState(...(effectArgs as any[]))
      if (isCacheEntryStale(entry, resolvedStaleTime)) {
        queryHandleInternal.fetch(...(effectArgs as any[])).catch(() => {
          // Error surfaces via cacheEntry.error; swallow the rejection
          // to avoid unhandled promise warnings.
        })
      }
    }

    return () => {
      queryHandleInternal.unobserve(effectArgs, () => {
        queryHandleInternal.reset(...(effectArgs as any[]))
      })
    }
  }, [hash, enabled, queryHandleInternal, resolvedStaleTime])

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
    return queryHandleInternal.fetch(...(argsRef.current as any[]))
  }, [queryHandleInternal, hash])

  const isStale = isCacheEntryStale(cacheEntry, resolvedStaleTime)

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
