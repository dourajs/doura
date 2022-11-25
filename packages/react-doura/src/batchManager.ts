import { unstable_batchedUpdates } from 'react-dom'
import type { AnyModel, ModelPublicInstance } from 'doura'

const createBatchManager = () => {
  // store models which is using now
  const modelBindRender = new WeakMap<
    ModelPublicInstance<AnyModel>,
    Set<() => void>
  >()
  const douraUnSub = new WeakMap<ModelPublicInstance<AnyModel>, () => void>()

  // add models to listen
  const addSubscribe = function (
    model: ModelPublicInstance<AnyModel>,
    fn: () => void
  ) {
    let modelsFnSet = modelBindRender.get(model)
    if (!modelsFnSet) {
      modelsFnSet = new Set()
      modelsFnSet.add(fn)
      const unSubscribe = model.$subscribe(function () {
        triggerSubscribe(model) // render self;
      })
      modelBindRender.set(model, modelsFnSet)
      douraUnSub.set(model, unSubscribe)
    } else {
      modelsFnSet.add(fn)
    }
    return function () {
      return removeSubscribe(model, fn)
    }
  }

  // remove models to listen
  const removeSubscribe = function (
    model: ModelPublicInstance<AnyModel>,
    fn: () => void
  ) {
    let modelsFnSet = modelBindRender.get(model)
    if (modelsFnSet) {
      modelsFnSet.delete(fn)
      if (modelsFnSet.size === 0 && douraUnSub.has(model)) {
        modelBindRender.delete(model)
        const UnSubFn = douraUnSub.get(model)
        if (UnSubFn) {
          UnSubFn()
          douraUnSub.delete(model)
        }
      }
    }
  }

  // listen to models in using
  const triggerSubscribe = function (model: ModelPublicInstance<AnyModel>) {
    const updateList: (() => void)[] = Array.from(
      modelBindRender.get(model) || []
    )

    unstable_batchedUpdates(() => {
      let update: (() => void) | undefined = updateList.pop()

      while (update) {
        update()

        update = updateList.pop()
      }
    })
  }

  return {
    addSubscribe,
    triggerSubscribe,
  }
}

export { createBatchManager }
