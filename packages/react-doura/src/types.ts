import { AnyModel, Selector, ModelAPI } from 'doura'

export interface UseAnonymousModel {
  <IModel extends AnyModel>(model: IModel): ModelAPI<IModel>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}

export interface UseNamedModel {
  <IModel extends AnyModel>(name: string, model: IModel): ModelAPI<IModel>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    name: string,
    model: IModel,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}

export interface UseModel extends UseAnonymousModel, UseNamedModel {}

export interface useAnonymousStaticModel {
  <IModel extends AnyModel>(model: IModel): ModelAPI<IModel>
}

export interface UseStaticModel {
  <IModel extends AnyModel>(name: string, model: IModel): ModelAPI<IModel>
}
