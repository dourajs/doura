import {
  useDebugValue,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import {
  Doura,
  AnyModel,
  Selector,
  ModelView,
  ModelPublicInstance,
  hasOwn,
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

  // Track depends/selector changes via a version counter so that
  // useMemo always receives a fixed-length deps array ([model, version]).
  // This avoids spreading user-provided `depends` into useMemo deps,
  // which would violate React's requirement for constant deps length.
  const prevRef = useRef<{
    depends: any[] | undefined
    selector: S
    version: number
  }>({ depends, selector, version: 0 })

  const prev = prevRef.current
  let { version } = prev
  if (depends !== undefined) {
    if (!shallowArrayEqual(prev.depends, depends)) {
      version = prev.version + 1
    }
  } else {
    if (prev.selector !== selector) {
      version = prev.version + 1
    }
  }
  prevRef.current = { depends, selector, version }

  const view = useMemo(() => {
    const preMv: ModelView | undefined = selectorRef.current
    if (preMv) {
      preMv.destroy()
    }

    const mv = (selectorRef.current = model.$createView(selector))

    return mv
  }, [model, version])

  useEffect(() => {
    return () => {
      selectorRef.current?.destroy()
    }
  }, [])

  const state = useSyncExternalStore<ReturnType<S>>(subscribe, view, view)

  useDebugValue(state)

  return state
}

function useModelInstance<IModel extends AnyModel>(
  name: string,
  model: IModel,
  doura: Doura
) {
  const { modelInstance, subscribe } = useMemo(
    () => {
      const modelInstance = doura.getModel(name, model)
      return {
        modelInstance,
        subscribe: (onModelChange: () => void) =>
          modelInstance.$subscribe(() => onModelChange()),
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
  (doura: Doura) =>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    name: string,
    model: IModel,
    selector?: S,
    depends?: any[]
  ) => {
    const hasSelector = useRef(selector)
    const { modelInstance, subscribe } = useModelInstance(name, model, doura)

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
