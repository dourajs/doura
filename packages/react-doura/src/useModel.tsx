import { useMemo } from 'react'
import { doura } from 'doura'
import type { AnyModel, Selector } from 'doura'
import { createBatchManager } from './batchManager'
import { createUseModel } from './createUseModel'
import { IUseModel } from './types'

const useModel: IUseModel = <
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

  return useMemo(
    function () {
      return createUseModel(douraStore, batchManager)
    },
    [douraStore, batchManager]
  )(model, selector, depends)
}

export { useModel }
