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

  // StrictMode runs effects as setup→cleanup→setup with no render in between.
  // The store is created in render (via useRef lazy init) and all downstream
  // hooks bind to it during render. Cleanup must NOT synchronously destroy
  // the store — instead it schedules a microtask. If setup re-runs (StrictMode),
  // mountedRef is set back to true and the microtask skips destruction.
  // On real unmount, mountedRef stays false and the store is destroyed.
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
