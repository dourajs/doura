import { AnyModel, AnyObjectModel, ModelActions } from './modelOptions'
import { ModelInternal, ModelAPI } from './model'
import { ModelInstance } from './modelPublicInstance'
import { removeUnordered } from '../utils'

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
  const view = instance.createView(function (this: ModelInstance<IModel>) {
    return selector(this as unknown as ModelAPI<IModel>, this.$actions)
  })

  const res = view.getSnapshot as ModelView<Selector<IModel, TReturn>>
  res.destroy = function () {
    view.effect.stop()
    removeUnordered(instance.effectScope.effects, view.effect)
    removeUnordered(instance.viewInstances, view as any)
  }

  return res
}
