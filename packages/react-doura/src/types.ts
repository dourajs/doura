import { AnyModel, Selector, ModelPublicInstance, ModelAPI } from 'doura'

type IActions<IModel extends AnyModel> = ModelPublicInstance<IModel>['$actions']

export interface IUseModel {
  <IModel extends AnyModel>(model: IModel): [ModelAPI<IModel>, IActions<IModel>]
  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
    selectors: S,
    depends?: any[]
  ): [ReturnType<S>, IActions<IModel>]
}

export interface IUseNamedModel {
  <IModel extends AnyModel>(name: string, model: IModel): [
    ModelAPI<IModel>,
    IActions<IModel>
  ]
  <IModel extends AnyModel, S extends Selector<IModel>>(
    name: string,
    model: IModel,
    selectors: S,
    depends?: any[]
  ): [ReturnType<S>, IActions<IModel>]
}

export interface IUseNamedStaticModel {
  <IModel extends AnyModel>(name: string, model: IModel): [
    { current: ModelAPI<IModel> },
    IActions<IModel>
  ]
}
