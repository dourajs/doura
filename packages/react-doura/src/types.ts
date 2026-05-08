import { AnyModel, AnyObjectModel, Selector, ModelAPI } from 'doura'

export type NamedObjectModel = AnyObjectModel & { name: string }

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

export interface UseModel extends UseNamedModel {
  <IModel extends NamedObjectModel>(model: IModel): ModelAPI<IModel>
  <IModel extends NamedObjectModel, S extends Selector<IModel>>(
    model: IModel,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}

export interface useAnonymousStaticModel {
  <IModel extends AnyModel>(model: IModel): ModelAPI<IModel>
}

export interface UseStaticModel {
  <IModel extends AnyModel>(name: string, model: IModel): ModelAPI<IModel>
}
