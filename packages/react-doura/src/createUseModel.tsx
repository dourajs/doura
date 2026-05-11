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
  doura: Doura
) {
  const modelKey = getModelCacheKey(model)
  const modelInstanceRef = useRef<{
    doura: Doura
    modelKey: string
    modelInstance: ModelInstance<ModelDef>
  }>()

  if (
    !modelInstanceRef.current ||
    modelInstanceRef.current.doura !== doura ||
    modelInstanceRef.current.modelKey !== modelKey
  ) {
    const modelInstance = doura.getModel(model)
    modelInstanceRef.current = {
      doura,
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

export const createUseModel =
  (doura: Doura) =>
  <ModelDef extends ModelDefinition<Model>, S extends Selector<ModelDef>>(
    model: ModelDef,
    selector?: S,
    depends?: any[]
  ) => {
    const { modelInstance, subscribe } = useModelInstance(model, doura)

    return useModelState(modelInstance, subscribe, selector, depends)
  }

export const createUseStaticModel =
  (doura: Doura) =>
  <ModelDef extends ModelDefinition<Model>>(model: ModelDef) => {
    const { modelInstance } = useModelInstance(model, doura)

    return modelInstance as any as ModelAPI<ModelDef>
  }
