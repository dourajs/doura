import { Model, ModelActions, ModelDefinition } from './modelOptions'
import { ModelInternal, ModelAPI } from './model'
import { ModelInstance } from './modelPublicInstance'
import { removeUnordered } from '../utils'

export type Selector<ModelDef extends ModelDefinition<Model>, TReturn = any> = (
  api: ModelAPI<ModelDef>,
  actions: ModelActions<ModelDef>
) => TReturn

export interface ModelView<T extends (...args: any[]) => any = any> {
  (): ReturnType<T>
  destroy(): void
}

export function createView<M extends Model, TReturn>(
  instance: ModelInternal<M>,
  selector: Selector<ModelDefinition<M>, TReturn>
): ModelView<Selector<ModelDefinition<M>, TReturn>> {
  const view = instance.createView(function (
    this: ModelInstance<ModelDefinition<M>>
  ) {
    return selector(
      this as unknown as ModelAPI<ModelDefinition<M>>,
      this.$actions
    )
  })

  const res = view.getSnapshot as ModelView<
    Selector<ModelDefinition<M>, TReturn>
  >
  res.destroy = function () {
    view.effect.stop()
    removeUnordered(instance.effectScope.effects, view.effect)
    removeUnordered(instance.viewInstances, view as any)
  }

  return res
}
