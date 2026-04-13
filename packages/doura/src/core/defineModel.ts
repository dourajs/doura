import { State, ActionOptions, ViewOptions, ModelOptions } from './modelOptions'

export type DefineModel<
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions
> = ModelOptions<S, A, V> & {} // BUG: {} is required

export const defineModel = <
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions<S>
>(
  modelOptions: ModelOptions<S, A, V>
): DefineModel<S, A, V> => {
  return modelOptions as ModelOptions<S, A, V>
}
