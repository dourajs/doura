import { useEffect, useMemo, useRef } from 'react'
import { doura, AnyModel, Selector, Doura } from 'doura'
import { createUseModel } from './createUseModel'
import { UseAnonymousModel, UseModel, UseStaticModel } from './types'
import { DouraRoot, useRootModel, useRootStaticModel } from './global'

const ANONYMOUS_MODEL_NAME = 'anonymous model'

const useAnonymousModel: UseAnonymousModel = <
  IModel extends AnyModel,
  S extends Selector<IModel>
>(
  model: IModel,
  selector?: S,
  depends?: any[]
) => {
  // for hmr feature
  // useRef can keep context
  const context = useRef<{
    douraStore: Doura
  } | null>(null)

  if (!context.current) {
    context.current = {
      douraStore: doura(),
    }
  }

  // The store is created in render (via useRef lazy init). Its lifetime is
  // tied to the component — destroy on real unmount only. StrictMode's
  // simulated unmount must NOT destroy it, because hooks rendered against
  // this store (useModelInstance, useModelWithSelector) capture the store
  // during render and there is no re-render between StrictMode's effect
  // cleanup and the second effect setup.
  //
  // We use a mounted flag: cleanup clears it, setup sets it. A microtask
  // scheduled in cleanup checks whether setup re-ran (StrictMode) or not
  // (real unmount) and only destroys in the latter case.
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const store = context.current?.douraStore
      if (store) {
        Promise.resolve().then(() => {
          if (!mountedRef.current) {
            store.destroy()
            context.current = null
          }
        })
      }
    }
  }, [])

  return useMemo(
    function () {
      return createUseModel(context.current!.douraStore)
    },
    [context.current.douraStore]
  )(ANONYMOUS_MODEL_NAME, model, selector, depends)
}

const useModel = ((name: any, model: any, selector?: any, depends?: any) => {
  if (typeof name === 'string') {
    return useRootModel(name, model, selector, depends)
  }

  return useAnonymousModel(name, model, selector)
}) as UseModel

const useStaticModel: UseStaticModel = (name, model) => {
  return useRootStaticModel(name, model)
}

export { DouraRoot, useModel, useStaticModel }
