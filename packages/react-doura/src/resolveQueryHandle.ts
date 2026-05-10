import type {
  InternalQueryDefinitionRef,
  InternalQueryFetch,
  InternalQueryHandle,
  QueryFetch,
  QueryHandle,
} from 'doura'
import { DOURA_QUERY_HANDLE, DOURA_QUERY_REF } from 'doura'
import { assertDouraContext } from './errors'

export function resolveQueryHandle(
  query: QueryHandle<any, any> | QueryFetch<any, any>,
  context: { store: any } | null
): InternalQueryHandle<any, any> {
  const fetch = query as InternalQueryFetch<any, any>
  const boundHandle = fetch?.[DOURA_QUERY_HANDLE]
  if (boundHandle) {
    return boundHandle
  }

  const ref = (query as InternalQueryDefinitionRef<any, any>)?.[DOURA_QUERY_REF]
  if (ref) {
    return assertDouraContext(context).store.getModel(ref.model).$queries[
      ref.queryName
    ] as InternalQueryHandle<any, any>
  }

  return query as InternalQueryHandle<any, any>
}
