import type {
  AnyModel,
  ModelActions,
  ModelModels,
  ModelQueries,
  ModelState,
  ModelViews,
  StripIndexSignature,
} from './modelOptions'

// Keep each section stripped independently so optional/absent model sections
// don't leak broad index signatures into the merged public API shape.
export type ModelPublicFields<IModel extends AnyModel> = StripIndexSignature<
  ModelState<IModel>
> &
  StripIndexSignature<ModelViews<IModel>> &
  StripIndexSignature<ModelActions<IModel>> &
  StripIndexSignature<ModelQueries<IModel>> &
  StripIndexSignature<ModelModels<IModel>>
