import { AnyModel, Selector, ModelPublicInstance, ModelData } from 'doura'

type IActions<IModel extends AnyModel> = ModelPublicInstance<IModel>['$actions']

export interface IUseModel {
  <IModel extends AnyModel>(model: IModel): [
    ModelData<IModel>,
    IActions<IModel>
  ]
  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
    selectors: S,
    depends?: any[]
  ): [ReturnType<S>, IActions<IModel>]
}

export interface IUseSharedModel {
  <IModel extends AnyModel>(name: string, model: IModel): [
    ModelData<IModel>,
    IActions<IModel>
  ]
  <IModel extends AnyModel, S extends Selector<IModel>>(
    name: string,
    model: IModel,
    selectors: S,
    depends?: any[]
  ): [ReturnType<S>, IActions<IModel>]
}

export interface IUseStaticModel {
  <IModel extends AnyModel>(model: IModel): [
    { current: ModelData<IModel> },
    IActions<IModel>
  ]
}
