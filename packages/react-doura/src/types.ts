import { Model, ModelDefinition, Selector, ModelAPI } from 'doura'

export interface UseDetachedModel {
  <ModelDef extends ModelDefinition<Model>>(model: ModelDef): ModelAPI<ModelDef>
  <ModelDef extends ModelDefinition<Model>, S extends Selector<ModelDef>>(
    model: ModelDef,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}

export interface UseModel {
  <ModelDef extends ModelDefinition<Model>>(model: ModelDef): ModelAPI<ModelDef>
  <ModelDef extends ModelDefinition<Model>, S extends Selector<ModelDef>>(
    model: ModelDef,
    selectors: S,
    depends?: any[]
  ): ReturnType<S>
}

export interface UseSharedModel extends UseModel {}

export interface UseDetachedStaticModel {
  <ModelDef extends ModelDefinition<Model>>(model: ModelDef): ModelAPI<ModelDef>
}

export interface UseStaticModel {
  <ModelDef extends ModelDefinition<Model>>(model: ModelDef): ModelAPI<ModelDef>
}
