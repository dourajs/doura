import { useMemo, useRef } from 'react'
import { doura } from 'doura'
import type { AnyModel, Selector } from 'doura'
import { createBatchManager } from './batchManager'
import { createUseModel } from './createUseModel'
import { UseModel } from './types'

const useModel: UseModel = <
  IModel extends AnyModel,
  S extends Selector<IModel>
>(
  model: IModel,
  selector?: S,
  depends?: any[]
) => {
  let [douraStore, batchManager] = useMemo(function () {
    return [doura(), createBatchManager()]
  }, [])

  const context = useRef({
    douraStore,
    batchManager,
  })

  return useMemo(
    function () {
      return createUseModel(
        context.current.douraStore,
        context.current.batchManager
      )
    },
    [context.current.douraStore, context.current.batchManager]
  )(model, selector, depends)
}

export { useModel }
