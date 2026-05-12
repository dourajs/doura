import {
  createContext,
  useContext,
  type PropsWithChildren,
  useEffect,
  useRef,
  useMemo,
} from 'react'
import {
  type Doura,
  type Model,
  type ModelDefinition,
  type DouraOptions,
  type Selector,
  doura,
  nextTick,
} from 'doura'
import { useModelImpl, useStaticModelImpl } from './useModel'
import { useQueryImpl } from './useQuery'
import { useActionImpl } from './useAction'
import { useInfiniteQueryImpl } from './useInfiniteQuery'
import type { UseSharedModel, UseStaticModel } from './types'
import type { UseQuery } from './queryTypes'
import type { UseAction } from './useAction'
import type { UseInfiniteQuery } from './useInfiniteQuery'
import { DouraContext } from './context'
import { assertDouraContext } from './errors'

const createContainer = (options?: DouraOptions) => {
  const Context = createContext<{
    store: Doura
  }>(null as any)
  function Provider(props: PropsWithChildren<{ store?: Doura }>) {
    const { children, store: propsStore } = props
    const internalStoreRef = useRef<Doura | null>(null)
    const pendingDestroyStoreRef = useRef<Doura | null>(null)

    const memoContext = useMemo(() => {
      let store: Doura
      if (propsStore) {
        store = propsStore
      } else {
        if (!internalStoreRef.current) {
          internalStoreRef.current = doura(options)
        }
        store = internalStoreRef.current
      }
      return {
        doura: { store },
        ownsStore: !propsStore,
      }
    }, [propsStore])

    useEffect(() => {
      const store = memoContext.doura.store
      if (pendingDestroyStoreRef.current === store) {
        pendingDestroyStoreRef.current = null
      }

      return () => {
        if (memoContext.ownsStore && internalStoreRef.current === store) {
          pendingDestroyStoreRef.current = store
          nextTick(() => {
            if (
              pendingDestroyStoreRef.current === store &&
              internalStoreRef.current === store
            ) {
              store.destroy()
              internalStoreRef.current = null
              pendingDestroyStoreRef.current = null
            }
          })
        }
      }
    }, [memoContext])

    return (
      <DouraContext.Provider value={memoContext.doura}>
        <Context.Provider value={memoContext.doura}>
          {children}
        </Context.Provider>
      </DouraContext.Provider>
    )
  }

  const useDouraContext = () => {
    const context = useContext(Context)
    assertDouraContext(context)
    return context
  }

  const useSharedModel: UseSharedModel = <
    ModelDef extends ModelDefinition<Model>,
    S extends Selector<ModelDef>,
  >(
    model: ModelDef,
    selector?: S,
    depends?: any[]
  ) => {
    const context = useDouraContext()
    return useModelImpl(context, model, selector, depends)
  }

  const useStaticModel: UseStaticModel = <
    ModelDef extends ModelDefinition<Model>,
  >(
    model: ModelDef
  ) => {
    const context = useDouraContext()
    return useStaticModelImpl(context, model)
  }

  const useQuery: UseQuery = (
    queryHandle: any,
    argsOrOptions?: any,
    maybeOptions?: any
  ) => {
    const context = useDouraContext()
    return useQueryImpl(context, queryHandle, argsOrOptions, maybeOptions)
  }

  const useAction: UseAction = (action: any, options?: any) => {
    const context = useDouraContext()
    return useActionImpl(context, action, options)
  }

  const useInfiniteQuery: UseInfiniteQuery = (
    queryHandle: any,
    config: any
  ) => {
    const context = useDouraContext()
    return useInfiniteQueryImpl(context, queryHandle, config)
  }

  return {
    Provider,
    useSharedModel,
    useStaticModel,
    useQuery,
    useAction,
    useInfiniteQuery,
  }
}

export type { Doura, Selector } from 'doura'

export { createContainer }
