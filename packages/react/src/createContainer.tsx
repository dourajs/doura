import React, {
  createContext,
  useContext,
  PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { doura } from 'doura'
import devtool from 'doura/devtool'
import type { Doura, AnyModel, DouraOptions, Selector } from 'doura'
import { createUseSharedModel, createUseStaticModel } from './createUseModel'
import { createBatchManager } from './batchManager'
import { IUseSharedModel, IUseStaticModel } from './types'
import { invariant } from './utils'

const createContainer = function (options?: DouraOptions) {
  const Context = createContext<{
    store: Doura
    batchManager: ReturnType<typeof createBatchManager>
  }>(null as any)
  function Provider(props: PropsWithChildren<{ store?: Doura }>) {
    const { children, store: propsStore } = props

    const memoContext = useMemo(
      function () {
        let store: Doura
        if (propsStore) {
          store = propsStore
        } else {
          store = doura(options)
        }
        const batchManager = createBatchManager()

        return {
          store,
          batchManager,
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

    return <Context.Provider value={contextValue}>{children}</Context.Provider>
  }

  const useSharedModel: IUseSharedModel = <
    IModel extends AnyModel,
    S extends Selector<IModel>
  >(
    name: string,
    model: IModel,
    selector?: S,
    depends?: any[]
  ) => {
    const context = useContext(Context)

    invariant(model.name, 'name is required.')
    invariant(
      context,
      'You should wrap your Component in createContainer().Provider.'
    )

    const { store, batchManager } = context

    return useMemo(
      () => createUseSharedModel(store, batchManager),
      [store, batchManager]
    )(name, model, selector, depends)
  }

  const useStaticModel: IUseStaticModel = <IModel extends AnyModel>(
    model: IModel
  ) => {
    const context = useContext(Context)

    invariant(model.name, 'name is required.')
    invariant(
      context,
      'You should wrap your Component in createContainer().Provider.'
    )

    const { store, batchManager } = context

    return useMemo(
      () => createUseStaticModel(store, batchManager),
      [store, batchManager]
    )(model)
  }

  return {
    Provider,
    useSharedModel,
    useStaticModel,
  }
}

const {
  Provider: DouraRoot,
  useSharedModel: useRootModel,
  useStaticModel: useRootStaticModel,
} = createContainer({
  plugins: process.env.NODE_ENV === 'development' ? [[devtool]] : [],
})

export { DouraRoot, useRootModel, useRootStaticModel }

export default createContainer
