import React, {
  createContext,
  useContext,
  type PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { createUseModel, createUseStaticModel } from './createUseModel'
import type { UseSharedModel, UseStaticModel } from './types'
import { DouraContext } from './context'
import { MISSING_PROVIDER_MESSAGE } from './errors'

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
        store,
        ownsStore: !propsStore,
      }
    }, [propsStore])

    const [contextValue, setContextValue] = useState(memoContext) // for hmr keep contextValue

    useEffect(() => {
      setContextValue(memoContext)
    }, [memoContext])

    useEffect(() => {
      if (pendingDestroyStoreRef.current === memoContext.store) {
        pendingDestroyStoreRef.current = null
      }

      return () => {
        if (
          memoContext.ownsStore &&
          internalStoreRef.current === memoContext.store
        ) {
          pendingDestroyStoreRef.current = memoContext.store
          nextTick(() => {
            if (
              pendingDestroyStoreRef.current === memoContext.store &&
              internalStoreRef.current === memoContext.store
            ) {
              memoContext.store.destroy()
              internalStoreRef.current = null
              pendingDestroyStoreRef.current = null
            }
          })
        }
      }
    }, [memoContext])

    return (
      <DouraContext.Provider value={contextValue}>
        <Context.Provider value={contextValue}>{children}</Context.Provider>
      </DouraContext.Provider>
    )
  }

  const useDouraContext = () => {
    const context = useContext(Context)

    if (__DEV__ && !context) {
      throw new Error(MISSING_PROVIDER_MESSAGE)
    }
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
    const { store } = useDouraContext()
    return useMemo(() => createUseModel(store), [store])(
      model,
      selector,
      depends
    )
  }

  const useStaticModel: UseStaticModel = <
    ModelDef extends ModelDefinition<Model>,
  >(
    model: ModelDef
  ) => {
    const { store } = useDouraContext()
    return useMemo(() => createUseStaticModel(store), [store])(model)
  }

  return {
    Provider,
    useSharedModel,
    useStaticModel,
  }
}

export type { Doura, Selector } from 'doura'

export { createContainer }
