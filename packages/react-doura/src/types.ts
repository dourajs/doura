import { AnyModel, Selector, ModelAPI } from 'doura'

export interface UseModel {
  <IModel extends AnyModel>(model: IModel, depends?: any[]): ModelAPI<IModel>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}

export interface UseNamedModel {
  <IModel extends AnyModel>(
    name: string,
    model: IModel,
    depends?: any[]
  ): ModelAPI<IModel>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    name: string,
    model: IModel,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}

export interface UseNamedStaticModel {
  <IModel extends AnyModel>(name: string, model: IModel): ModelAPI<IModel>
}
