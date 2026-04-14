import React, {
  createContext,
  useContext,
  PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Doura, AnyModel, DouraOptions, Selector, doura } from 'doura'
import { createUseModel, createUseStaticModel } from './createUseModel'
import { UseNamedModel, UseStaticModel } from './types'

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

    const memoContext = useMemo(
      function () {
        let store: Doura
        if (propsStore) {
          store = propsStore
        } else {
          store = doura(options)
          internalStoreRef.current = store
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
        return function () {
          internalStoreRef.current?.destroy()
          internalStoreRef.current = null
        }
      },
      [memoContext]
    )

    return <Context.Provider value={contextValue}>{children}</Context.Provider>
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
    S extends Selector<IModel>
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
