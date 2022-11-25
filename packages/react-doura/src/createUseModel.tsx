import { useDebugValue, useMemo, useRef } from 'react'
import {
  Doura,
  AnyModel,
  Selector,
  ModelView,
  ModelPublicInstance,
  hasOwn,
} from 'doura'
import { useSyncExternalStore } from 'use-sync-external-store/shim'
import { createBatchManager } from './batchManager'

type SubscribeFn = (onStoreChange: () => void) => () => void

function readonlyModel(model: ModelPublicInstance<AnyModel>) {
  return new Proxy(model, {
    get(target: ModelPublicInstance<AnyModel>, key: string | symbol): any {
      if (key === '$state') {
        return target.$state
      } else if (hasOwn(target.$state, key)) {
        return target.$state[key]
      } else if (hasOwn(target.$views, key)) {
        return target.$views[key]
      }

      return undefined
    },
    set() {
      console.warn(`try to change state which is not allowed!`)
      return false
    },
  })
}

function useModel<IModel extends AnyModel>(
  model: ModelPublicInstance<IModel>,
  subscribe: SubscribeFn
) {
  const view = useMemo(() => () => model.$getApi(), [model])

  const state = useSyncExternalStore(subscribe, view, view)

  useDebugValue(state)

  return [state, model.$actions] as [any, any]
}

function useModelWithSelector<
  IModel extends AnyModel,
  S extends Selector<IModel>
>(
  model: ModelPublicInstance<IModel>,
  subscribe: SubscribeFn,
  selector: S,
  depends?: any[]
) {
  const selectorRef = useRef<undefined | ModelView>(undefined)

  const view = useMemo(() => {
    let preMv: ModelView | undefined = selectorRef.current
    let mv: ModelView
    if (preMv) {
      preMv.destory()
    }

    mv = selectorRef.current = model.$createView(selector)

    return mv
  }, [model, ...(depends ? depends : [selector])])

  const state = useSyncExternalStore<ReturnType<S>>(subscribe, view, view)

  useDebugValue(state)

  return [state, model.$actions] as [any, any]
}

function useModelInstance<IModel extends AnyModel>(
  name: string,
  model: IModel,
  doura: Doura,
  batchManager: ReturnType<typeof createBatchManager>
) {
  const { modelInstance, subscribe } = useMemo(
    () => {
      const modelInstance = doura.getModel(name, model)
      return {
        modelInstance,
        subscribe: (onModelChange: () => void) =>
          batchManager.addSubscribe(modelInstance, onModelChange),
      }
    },
    // ignore model's change
    [name, doura]
  )

  return {
    modelInstance,
    subscribe,
  }
}

export const createUseNamedModel =
  (doura: Doura, batchManager: ReturnType<typeof createBatchManager>) =>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    name: string,
    model: IModel,
    selector?: S,
    depends?: any[]
  ) => {
    const hasSelector = useRef(selector)
    const { modelInstance, subscribe } = useModelInstance(
      name,
      model,
      doura,
      batchManager
    )

    // todo: warn when hasSelector changes
    if (hasSelector.current) {
      return useModelWithSelector(modelInstance, subscribe, selector!, depends)
    } else {
      return useModel(modelInstance, subscribe)
    }
  }

export const createUseModel =
  (doura: Doura, batchManager: ReturnType<typeof createBatchManager>) =>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
    selector?: S,
    depends?: any[]
  ) => {
    const hasSelector = useRef(selector)
    const { modelInstance, subscribe } = useModelInstance(
      'useModel', // name donen't matter here, use "@" for simplicity
      model,
      doura,
      batchManager
    )

    // todo: warn when hasSelector changes
    if (hasSelector.current) {
      return useModelWithSelector(modelInstance, subscribe, selector!, depends)
    } else {
      return useModel(modelInstance, subscribe)
    }
  }

export const createUseNamedStaticModel =
  (doura: Doura, _batchManager: ReturnType<typeof createBatchManager>) =>
  <IModel extends AnyModel>(name: string, model: IModel) => {
    const modelInstance = useMemo(
      () => doura.getModel(name, model),
      // ignore model's change
      [doura]
    )
    const value = useRef<any>()

    // only run this once against a model
    const stateRef = useMemo(() => {
      return {
        get current() {
          if (process.env.NODE_ENV === 'development') {
            return readonlyModel(modelInstance)
          } else {
            return modelInstance
          }
        },
      }
    }, [modelInstance])

    value.current = stateRef

    return [value.current, modelInstance.$actions] as [any, any]
  }
