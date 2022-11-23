import {
  State,
  ActionOptions,
  ViewOptions,
  Params,
  ModelOptions,
} from './modelOptions'

export type DefineModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  P extends Params
> = ModelOptions<S, A, V, P> & {} // BUG: {} is required

export const defineModel = <
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions<S>,
  P extends Params
>(
  modelOptions: ModelOptions<S, A, V, P>
): DefineModel<S, A, V, P> => {
  return modelOptions as ModelOptions<S, A, V, P>
}
