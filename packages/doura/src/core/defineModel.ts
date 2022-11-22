import {
  State,
  ActionOptions,
  ViewOptions,
  Models,
  validateModelOptions,
  ModelOptions,
} from './modelOptions'

/**
 * @template S State
 * @template MC dependency models
 */
export type DefineModel<
  N extends string,
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  M extends Models
> = ModelOptions<N, S, A, V, M> & {} // BUG: {} is required

export const defineModel = <
  N extends string,
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions<S>,
  M extends Models
>(
  modelOptions: ModelOptions<N, S, A, V, M>
): DefineModel<N, S, A, V, M> => {
  if (process.env.NODE_ENV === 'development') {
    validateModelOptions(modelOptions)
  }

  return modelOptions as ModelOptions<N, S, A, V, M>
}
