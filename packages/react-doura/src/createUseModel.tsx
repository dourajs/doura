import { useDebugValue, useMemo, useRef } from 'react'
import {
  Doura,
  AnyModel,
  Selector,
  ModelView,
  ModelPublicInstance,
  hasOwn,
  ModelAPI,
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
      } else if (hasOwn(target.$actions, key)) {
        return target.$actions[key]
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

  return state
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
    const preMv: ModelView | undefined = selectorRef.current
    if (preMv) {
      preMv.destory()
    }

    const mv = (selectorRef.current = model.$createView(selector))

    return mv
  }, [model, ...(depends ? depends : [selector])])

  const state = useSyncExternalStore<ReturnType<S>>(subscribe, view, view)

  useDebugValue(state)

  return state
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

export const createUseModel =
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

export const createUseStaticModel =
  (doura: Doura) =>
  <IModel extends AnyModel>(name: string, model: IModel) => {
    const modelInstance = useMemo(
      () => doura.getModel(name, model),
      // ignore model's change
      [name, doura]
    )

    // only run this once against a model
    const store = useMemo(() => {
      if (__DEV__) {
        return readonlyModel(modelInstance)
      } else {
        return modelInstance
      }
    }, [modelInstance])

    return store as any as ModelAPI<IModel>
  }
