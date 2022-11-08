import { AnyModel, Selector, ModelPublicInstance, ModelSnapshot } from 'doura'

type IActions<IModel extends AnyModel> = ModelPublicInstance<IModel>['$actions']

export interface IUseModel {
  <IModel extends AnyModel>(model: IModel): [
    ModelSnapshot<IModel>,
    IActions<IModel>
  ]

  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
    selectors: S,
    depends?: any[]
  ): [ReturnType<S>, IActions<IModel>]
}

export interface IUseStaticModel {
  <IModel extends AnyModel>(model: IModel): [
    { current: ModelSnapshot<IModel> },
    IActions<IModel>
  ]
}
