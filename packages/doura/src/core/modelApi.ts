import type {
  ModelDefinition,
  Model,
  ModelActions,
  ModelModels,
  ModelQueryFetches,
  ModelState,
  ModelViews,
  StripIndexSignature,
} from './modelOptions'

type ModelApiFields<ModelDef extends ModelDefinition<Model>> =
  StripIndexSignature<ModelState<ModelDef>> &
    StripIndexSignature<ModelViews<ModelDef>> &
    StripIndexSignature<ModelActions<ModelDef>> &
    StripIndexSignature<ModelQueryFetches<ModelDef>>

// Keep each section stripped independently so optional/absent model sections
// don't leak broad index signatures into the merged public API shape.
export type ModelPublicFields<ModelDef extends ModelDefinition<Model>> =
  ModelApiFields<ModelDef> & StripIndexSignature<ModelModels<ModelDef>>

export type ModelApiSnapshot<ModelDef extends ModelDefinition<Model>> =
  ModelApiFields<ModelDef>
