import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { Doura, QueryFetch, QueryHandle, InternalQueryHandle } from 'doura'
import { resolveQueryHandle } from './resolveQueryHandle'

export interface InfiniteQueryConfig<TArgs extends readonly unknown[], TData> {
  /** Args for the first page. */
  initialArgs: TArgs
  /** Given the last loaded page (and all pages so far), return the args for
   *  the page AFTER it, or undefined when no more pages exist. */
  getNextArgs: (lastPage: TData, allPages: TData[]) => TArgs | undefined
  /** Optional — same idea as getNextArgs but for pages BEFORE the first. */
  getPreviousArgs?: (firstPage: TData, allPages: TData[]) => TArgs | undefined
}

export interface UseInfiniteQueryResult<
  TArgs extends readonly unknown[],
  TData,
> {
  data: { pages: TData[]; args: TArgs[] } | undefined
  error: unknown
  isLoading: boolean
  isFetching: boolean
  isSuccess: boolean
  isError: boolean
  hasNextPage: boolean
  hasPreviousPage: boolean
  isFetchingNextPage: boolean
  isFetchingPreviousPage: boolean
  fetchNextPage: () => Promise<void>
  fetchPreviousPage: () => Promise<void>
  refetch: () => Promise<void>
}

export type UseInfiniteQuery = <TArgs extends readonly unknown[], TData>(
  queryHandle: QueryInput<TArgs, TData>,
  config: InfiniteQueryConfig<NoInfer<TArgs>, TData>
) => UseInfiniteQueryResult<TArgs, TData>

type FetchKind = 'none' | 'initial' | 'next' | 'prev' | 'refetch'
type QueryInput<TArgs extends readonly unknown[], TData> =
  | QueryHandle<TArgs, TData>
  | QueryFetch<TArgs, TData>

interface InfiniteState<TArgs, TData> {
  pages: TData[]
  pageArgs: TArgs[]
  error: unknown
  fetchingKind: FetchKind
}

type InfiniteEvent<TArgs, TData> =
  | { type: 'fetching'; kind: Exclude<FetchKind, 'none'> }
  | {
      type: 'success'
      data: TData
      args: TArgs
      position: 'append' | 'prepend' | 'replace'
    }
  | { type: 'error'; error: unknown }
  | { type: 'reset' }

function infiniteReducer<TArgs, TData>(
  state: InfiniteState<TArgs, TData>,
  event: InfiniteEvent<TArgs, TData>
): InfiniteState<TArgs, TData> {
  switch (event.type) {
    case 'fetching':
      return { ...state, fetchingKind: event.kind }
    case 'success': {
      const pages =
        event.position === 'append'
          ? [...state.pages, event.data]
          : event.position === 'prepend'
            ? [event.data, ...state.pages]
            : [event.data]
      const pageArgs =
        event.position === 'append'
          ? [...state.pageArgs, event.args]
          : event.position === 'prepend'
            ? [event.args, ...state.pageArgs]
            : [event.args]
      return { pages, pageArgs, error: undefined, fetchingKind: 'none' }
    }
    case 'error':
      return { ...state, error: event.error, fetchingKind: 'none' }
    case 'reset':
      return {
        pages: [],
        pageArgs: [],
        error: undefined,
        fetchingKind: 'initial',
      }
  }
}

const INITIAL_STATE: InfiniteState<any, any> = {
  pages: [],
  pageArgs: [],
  error: undefined,
  fetchingKind: 'initial',
}

/**
 * Paginated query hook that accumulates pages fetched from the same query
 * across different args.
 *
 * - Initial fetch runs once on mount (StrictMode-safe via a ref guard).
 * - `fetchNextPage` / `fetchPreviousPage` compute the next/previous args
 *   from the user-supplied `getNextArgs` / `getPreviousArgs` and fetch
 *   through the query handle, which dedupes through the store's
 *   FetchManager so concurrent requesters of the same page share work.
 * - Race guard via runIdRef: only the latest page fetch writes state.
 *   Out-of-order resolves from superseded runs (e.g. refetch during a
 *   pending fetchNextPage) silently drop.
 * - `refetch` resets pages to just the initial args. For multi-page
 *   refresh semantics, call refetch then re-invoke fetchNextPage.
 *
 * Accumulated pages live in local component state. Per-page cache entries
 * are still populated in the model (so another useQuery on the same args
 * will read them back), but this hook does not subscribe to those caches.
 */
export function useInfiniteQueryImpl<TArgs extends readonly unknown[], TData>(
  context: { store: Doura } | null,
  queryHandle: QueryInput<TArgs, TData>,
  config: InfiniteQueryConfig<NoInfer<TArgs>, TData>
): UseInfiniteQueryResult<TArgs, TData> {
  const resolvedQueryHandle = resolveQueryHandle(queryHandle, context)
  const [state, dispatch] = useReducer(
    infiniteReducer as (
      s: InfiniteState<TArgs, TData>,
      e: InfiniteEvent<TArgs, TData>
    ) => InfiniteState<TArgs, TData>,
    INITIAL_STATE as InfiniteState<TArgs, TData>
  )
  const { pages, pageArgs, error, fetchingKind } = state

  // Latest config/handle via refs so stable callback identities still see
  // current values across renders.
  const configRef = useRef(config)
  configRef.current = config
  const handleRef = useRef(resolvedQueryHandle)
  handleRef.current = resolvedQueryHandle

  // Race guard — every fetchPage call is given a unique runId; only the
  // latest run's result is allowed to land. Cleanup does NOT increment it,
  // so StrictMode's double-mount still lets the first fetch land (the
  // isMountedRef gate handles post-unmount writes).
  const runIdRef = useRef(0)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchPage = useCallback(
    async (
      args: TArgs,
      position: 'append' | 'prepend' | 'replace',
      kind: Exclude<FetchKind, 'none'>,
      shouldDispatchFetching = true
    ): Promise<void> => {
      const runId = ++runIdRef.current
      if (shouldDispatchFetching && isMountedRef.current) {
        dispatch({ type: 'fetching', kind })
      }
      try {
        const data = await (
          handleRef.current.fetch as (...a: TArgs) => Promise<TData>
        )(...args)
        if (runIdRef.current !== runId) return
        if (!isMountedRef.current) return
        dispatch({ type: 'success', data, args, position })
      } catch (err) {
        if (runIdRef.current !== runId) return
        if (!isMountedRef.current) return
        dispatch({ type: 'error', error: err })
      }
    },
    []
  )

  // Fetch the initial page for each resolved handle. The handle changes when a
  // definition ref is rebound through a different Provider store.
  const fetchedHandleRef = useRef<InternalQueryHandle<any, any> | null>(null)
  useEffect(() => {
    if (fetchedHandleRef.current === resolvedQueryHandle) return
    fetchedHandleRef.current = resolvedQueryHandle
    dispatch({ type: 'reset' })
    void fetchPage(configRef.current.initialArgs, 'replace', 'initial', false)
  }, [fetchPage, resolvedQueryHandle])

  const fetchNextPage = useCallback(async (): Promise<void> => {
    if (pages.length === 0) return
    const next = configRef.current.getNextArgs(pages[pages.length - 1], pages)
    if (next === undefined) return
    await fetchPage(next, 'append', 'next')
  }, [pages, fetchPage])

  const fetchPreviousPage = useCallback(async (): Promise<void> => {
    const getPrev = configRef.current.getPreviousArgs
    if (!getPrev || pages.length === 0) return
    const prev = getPrev(pages[0], pages)
    if (prev === undefined) return
    await fetchPage(prev, 'prepend', 'prev')
  }, [pages, fetchPage])

  const refetch = useCallback(async (): Promise<void> => {
    await fetchPage(configRef.current.initialArgs, 'replace', 'refetch')
  }, [fetchPage])

  const hasData = pages.length > 0
  const hasError = error !== undefined && error !== null

  // Compute has*Page each render using the latest config. Cheap in practice
  // since user getNextArgs usually reads a cursor off the last page.
  const hasNextPage =
    hasData &&
    configRef.current.getNextArgs(pages[pages.length - 1], pages) !== undefined
  const getPrev = configRef.current.getPreviousArgs
  const hasPreviousPage =
    hasData && !!getPrev && getPrev(pages[0], pages) !== undefined

  const isFetching = fetchingKind !== 'none'
  const isLoading = !hasData && !hasError && isFetching

  return {
    data: hasData ? { pages, args: pageArgs } : undefined,
    error,
    isLoading,
    isFetching,
    isSuccess: hasData && !hasError,
    isError: hasError,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage: fetchingKind === 'next',
    isFetchingPreviousPage: fetchingKind === 'prev',
    fetchNextPage,
    fetchPreviousPage,
    refetch,
  }
}
