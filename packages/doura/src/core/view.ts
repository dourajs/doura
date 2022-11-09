import { AnyModel } from './defineModel'
import { Views } from './modelOptions'
import { ModelInternal } from './model'
import { EmptyObject } from '../types'

export type ModelSnapshot<Model extends AnyModel> = {
  $state: Model['state']
} & Model['state'] &
  Views<Model['views']> &
  EmptyObject

export type Selector<Model extends AnyModel, TReturn = any> = (
  stateAndViews: ModelSnapshot<Model>
) => TReturn

export interface ModelView<T extends (...args: any[]) => any = any> {
  (): ReturnType<T>
  destory(): void
}

export function createView<IModel extends AnyModel, TReturn>(
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
