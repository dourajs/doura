import { AnyModel } from './modelOptions'
import { ModelInternal } from './model'
import { ModelPublicInstance } from './modelPublicInstance'
import { currentModelContext } from './modelManager'

export function use<IModel extends AnyModel>(
  model: IModel
): ModelPublicInstance<IModel>
export function use<IModel extends AnyModel>(
  name: string,
  model: IModel
): ModelPublicInstance<IModel>
export function use(nameOrModel: any, model?: any): any {
  if (!currentModelContext) {
    throw new Error(
      `Invalid use() call. use() can only be called inside of the body of a function model. This could happen for one of the following reasons:
1. You might be breaking the Rules of Doura
2. You might have more than one copy of Doura in the same app`
    )
  }

  const { manager, model: parentModel } = currentModelContext
  let instance: ModelInternal

  let name: string
  if (typeof nameOrModel === 'string') {
    name = nameOrModel
    instance = manager.getModelInstance({ name, model })
  } else {
    model = nameOrModel
    instance = manager.getModelInstance({ model })
  }

  parentModel.addChild(instance)

  return instance.proxy
}
