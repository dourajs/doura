import { useMemo, useRef } from 'react'
import { doura, AnyModel, Selector, Doura } from 'doura'
import { createBatchManager } from './batchManager'
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
    batchManager: ReturnType<typeof createBatchManager>
  } | null>(null)

  if (!context.current) {
    context.current = {
      douraStore: doura(),
      batchManager: createBatchManager(),
    }
  }

  return useMemo(
    function () {
      return createUseModel(
        context.current!.douraStore,
        context.current!.batchManager
      )
    },
    [context.current.douraStore, context.current.batchManager]
  )(ANONYMOUS_MODEL_NAME, model, selector, depends)
}

const useModel: UseModel = (
  name: any,
  model: any,
  selector?: any,
  depends?: any
) => {
  if (typeof name === 'string') {
    return useRootModel(name, model, selector, depends)
  }

  return useAnonymousModel(name, model, selector)
}

const useStaticModel: UseStaticModel = (name, model) => {
  return useRootStaticModel(name, model)
}

export { DouraRoot, useModel, useStaticModel }
