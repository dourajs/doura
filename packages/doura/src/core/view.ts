import { AnyModel, AnyObjectModel, ModelActions } from './modelOptions'
import { ModelInternal, ModelAPI } from './model'
import { ModelPublicInstance } from './modelPublicInstance'

export type Selector<Model extends AnyModel, TReturn = any> = (
  api: ModelAPI<Model>,
  actions: ModelActions<Model>
) => TReturn

export interface ModelView<T extends (...args: any[]) => any = any> {
  (): ReturnType<T>
  destroy(): void
}

export function createView<IModel extends AnyObjectModel, TReturn>(
  instance: ModelInternal<IModel>,
  selector: Selector<IModel, TReturn>
): ModelView<Selector<IModel, TReturn>> {
  const view = instance.createView(function (
    this: ModelPublicInstance<IModel>
  ) {
    return selector(this, this.$actions)
  })

  const res = view.getSnapshot as ModelView<Selector<IModel, TReturn>>
  res.destroy = function () {
    view.effect.stop()
    const effectIndex = instance.effectScope.effects.indexOf(view.effect)
    if (effectIndex >= 0) {
      instance.effectScope.effects.splice(effectIndex, 1)
    }
    const viewIndex = instance.viewInstances.indexOf(view as any)
    if (viewIndex >= 0) {
      instance.viewInstances.splice(viewIndex, 1)
    }
  }

  return res
}
