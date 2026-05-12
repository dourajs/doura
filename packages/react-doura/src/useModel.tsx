import {
  useDebugValue,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import type {
  Doura,
  Model,
  ModelDefinition,
  Selector,
  ModelView,
  ModelInstance,
  ModelAPI,
} from 'doura'
import { doura } from 'doura'
import type { UseDetachedModel } from './types'

type SubscribeFn = (onStoreChange: () => void) => () => void

function shallowArrayEqual(
  a: any[] | undefined,
  b: any[] | undefined
): boolean {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false
  }
  return true
}

function readonlyModel<T>(model: T): T {
  return new Proxy(model as any, {
    get(target: ModelInstance<ModelDefinition>, key: string | symbol): any {
      return target[key as keyof typeof target]
    },
    set() {
      console.warn(`try to change state which is not allowed!`)
      return false
    },
  })
}

function getModelCacheKey(model: ModelDefinition<Model>) {
  return model.$options.name
}

function useModelState<
  ModelDef extends ModelDefinition<Model>,
  S extends Selector<ModelDef>,
>(
  model: ModelInstance<ModelDef>,
  subscribe: SubscribeFn,
  selector?: S,
  depends?: any[]
) {
  const hasSelector = useRef(selector)
  const modelRef = useRef(model)
  const selectorRef = useRef<undefined | ModelView>(undefined)

  const prevRef = useRef<{
    depends: any[] | undefined
    selector: S | undefined
    model: ModelInstance<ModelDef>
  }>({ depends, selector, model })

  modelRef.current = model

  if (__DEV__) {
    if (!!selector !== !!hasSelector.current) {
      console.warn(
        `[react-doura] useModel selector presence changed between renders. ` +
          `A component should always use a selector or never use one. ` +
          `Mixing both patterns in the same component is not supported.`
      )
    }
  }

  if (hasSelector.current) {
    const prev = prevRef.current
    let needsRecreate = !selectorRef.current || prev.model !== model
    if (!needsRecreate) {
      if (depends !== undefined) {
        needsRecreate = !shallowArrayEqual(prev.depends, depends)
      } else {
        needsRecreate = prev.selector !== selector
      }
    }

    if (needsRecreate) {
      selectorRef.current?.destroy()
      selectorRef.current = model.$createView(selector as S)
    }
  }

  prevRef.current = { depends, selector, model }

  // Stable wrapper so useSyncExternalStore always calls the live view,
  // even if the underlying ModelView is recreated after StrictMode cleanup.
  const getSnapshot = useMemo(
    () => () => {
      if (hasSelector.current) {
        return selectorRef.current!()
      }
      return modelRef.current.$getApi()
    },
    []
  )

  // StrictMode runs effects as setup→cleanup→setup with no render in between.
  // Cleanup synchronously destroys the view and nulls the ref. The subsequent
  // setup detects the null ref and re-creates the view from the still-alive
  // model. On real unmount only cleanup runs, which is the desired behavior.
  useEffect(() => {
    if (hasSelector.current && !selectorRef.current) {
      const prev = prevRef.current
      selectorRef.current = prev.model.$createView(prev.selector as S)
    }
    return () => {
      selectorRef.current?.destroy()
      selectorRef.current = undefined
    }
  }, [])

  const state = useSyncExternalStore<any>(subscribe, getSnapshot, getSnapshot)

  useDebugValue(state)

  return state
}

function useModelInstance<ModelDef extends ModelDefinition<Model>>(
  model: ModelDef,
  douraStore: Doura
) {
  const modelKey = getModelCacheKey(model)
  const modelInstanceRef = useRef<{
    doura: Doura
    modelKey: string
    modelInstance: ModelInstance<ModelDef>
  }>()

  if (
    !modelInstanceRef.current ||
    modelInstanceRef.current.doura !== douraStore ||
    modelInstanceRef.current.modelKey !== modelKey
  ) {
    const modelInstance = douraStore.getModel(model)
    modelInstanceRef.current = {
      doura: douraStore,
      modelKey,
      modelInstance: __DEV__ ? readonlyModel(modelInstance) : modelInstance,
    }
  }

  const modelInstance = modelInstanceRef.current.modelInstance
  const subscribe = useMemo(
    () => (onModelChange: () => void) => {
      return modelInstance.$subscribe(onModelChange)
    },
    [modelInstance]
  )

  return {
    modelInstance,
    subscribe,
  }
}

export function useModelImpl<
  ModelDef extends ModelDefinition<Model>,
  S extends Selector<ModelDef>,
>(context: { store: Doura }, model: ModelDef, selector?: S, depends?: any[]) {
  const { modelInstance, subscribe } = useModelInstance(model, context.store)
  return useModelState(modelInstance, subscribe, selector, depends)
}

export function useStaticModelImpl<ModelDef extends ModelDefinition<Model>>(
  context: { store: Doura },
  model: ModelDef
) {
  const { modelInstance } = useModelInstance(model, context.store)
  return modelInstance as any as ModelAPI<ModelDef>
}

export const useDetachedModel: UseDetachedModel = <
  ModelDef extends ModelDefinition<Model>,
  S extends Selector<ModelDef>,
>(
  model: ModelDef,
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

  // The detached store is created via doura() with no plugins, so there are
  // no onDestroy hooks or external subscriptions to clean up. All resources
  // (draft watchers, effect scope, model state) are only reachable through
  // this useRef and will be GC'd when the component unmounts.
  // View cleanup is handled by useModelWithSelector's own useEffect.

  return useModelImpl(
    { store: context.current.douraStore },
    model,
    selector,
    depends
  )
}
