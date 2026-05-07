import React, {
  createContext,
  useContext,
  PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Doura, AnyModel, DouraOptions, Selector, doura, nextTick } from 'doura'
import { createUseModel, createUseStaticModel } from './createUseModel'
import { UseNamedModel, UseStaticModel } from './types'
import { DouraContext } from './context'

function checkName(name: any) {
  if (!name) {
    throw new Error(`[react-doura]: "name" is required and can not be empty.`)
  }
}

const createContainer = function (options?: DouraOptions) {
  const Context = createContext<{
    store: Doura
  }>(null as any)
  function Provider(props: PropsWithChildren<{ store?: Doura }>) {
    const { children, store: propsStore } = props
    const internalStoreRef = useRef<Doura | null>(null)
    const pendingDestroyStoreRef = useRef<Doura | null>(null)

    const memoContext = useMemo(
      function () {
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
        }
      },
      [propsStore]
    )

    const [contextValue, setContextValue] = useState(memoContext) // for hmr keep contextValue

    useEffect(
      function () {
        setContextValue(memoContext)
      },
      [propsStore]
    )

    useEffect(
      function () {
        if (pendingDestroyStoreRef.current === memoContext.store) {
          pendingDestroyStoreRef.current = null
        }

        return function () {
          if (!propsStore && internalStoreRef.current === memoContext.store) {
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
      },
      [memoContext]
    )

    return (
      <DouraContext.Provider value={contextValue}>
        <Context.Provider value={contextValue}>{children}</Context.Provider>
      </DouraContext.Provider>
    )
  }

  const useDouraContext = () => {
    const context = useContext(Context)

    if (__DEV__ && !context) {
      throw new Error(
        `[react-doura]: could not find react-doura context value; please ensure the component is wrapped in a <Provider>.`
      )
    }
    return context
  }

  const useSharedModel: UseNamedModel = <
    IModel extends AnyModel,
    S extends Selector<IModel>,
  >(
    name: string,
    model: IModel,
    selector?: S,
    depends?: any[]
  ) => {
    if (__DEV__) {
      checkName(name)
    }

    const { store } = useDouraContext()
    return useMemo(() => createUseModel(store), [store])(
      name,
      model,
      selector,
      depends
    )
  }

  const useStaticModel: UseStaticModel = <IModel extends AnyModel>(
    name: string,
    model: IModel
  ) => {
    if (__DEV__) {
      checkName(name)
    }

    const { store } = useDouraContext()
    return useMemo(() => createUseStaticModel(store), [store])(name, model)
  }

  return {
    Provider,
    useSharedModel,
    useStaticModel,
  }
}

export type { Doura, Selector } from 'doura'

export { createContainer }
