import { AnyModel, Selector, ModelAPI } from 'doura'

export interface UseDetachedModel {
  <IModel extends AnyModel>(model: IModel): ModelAPI<IModel>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}

export interface UseModel {
  <IModel extends AnyModel>(model: IModel): ModelAPI<IModel>
  <IModel extends AnyModel, S extends Selector<IModel>>(
    model: IModel,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}

export interface UseSharedModel extends UseModel {}

export interface UseDetachedStaticModel {
  <IModel extends AnyModel>(model: IModel): ModelAPI<IModel>
}

export interface UseStaticModel {
  <IModel extends AnyModel>(model: IModel): ModelAPI<IModel>
}
