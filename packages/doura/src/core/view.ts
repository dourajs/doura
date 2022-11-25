import { AnyModel, AnyObjectModel } from './modelOptions'
import { ModelInternal, ModelAPI } from './model'

export type Selector<Model extends AnyModel, TReturn = any> = (
  api: ModelAPI<Model>
) => TReturn

export interface ModelView<T extends (...args: any[]) => any = any> {
  (): ReturnType<T>
  destory(): void
}

export function createView<IModel extends AnyObjectModel, TReturn>(
  instance: ModelInternal<IModel>,
  selector: Selector<IModel, TReturn>
): ModelView<Selector<IModel, TReturn>> {
  const view = instance.createView(function (this: any) {
    return selector(this)
  })

  const res = function () {
    return view.value
  } as ModelView<Selector<IModel, TReturn>>
  res.destory = function () {
    view.effect.stop()
    const index = instance.effectScope.effects.indexOf(view.effect)
    if (index >= 0) {
      instance.effectScope.effects.splice(index, 1)
    }
  }

  return res
}
