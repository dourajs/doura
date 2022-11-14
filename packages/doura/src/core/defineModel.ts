import {
  State,
  ActionOptions,
  ViewOptions,
  validateModelOptions,
  ModelOptions,
  GetModelName,
  GetModelDeps,
} from './modelOptions'
import { invariant } from '../utils'
import { Math, Tuple } from '../types'

type MakeDeps<
  T extends any[],
  L extends number = T['length'],
  Dep extends {} = {},
  N extends 1[] = []
> = L extends 0
  ? Dep
  : L extends 1
  ? Dep &
      {
        [K in GetModelName<T[0]> extends `${infer isString}`
          ? `${isString}`
          : `${N['length']}`]: ToDep<T[0]>
      } &
      GetModelDeps<T[0]>
  : T extends [infer First, ...infer Rest]
  ? MakeDeps<
      Rest,
      Math.Sub<L, 1>,
      Dep &
        {
          [K in GetModelName<First> extends `${infer isString}`
            ? `${isString}`
            : `${N['length']}`]: ToDep<First>
        } &
        GetModelDeps<First>,
      [...N, 1]
    >
  : never

type ToDep<T> = T extends DefineModel<infer _N, any, any, any, any> ? T : never

/**
 * @template S State
 * @template MC dependency models
 */
export type DefineModel<
  N extends string,
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  DM extends {}
> = ModelOptions<N, S, A, V, DM> & {} // BUG: {} is required

export const defineModel = <
  N extends string,
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions<S>,
  DM extends MakeDeps<DA>,
  DA extends any[] = []
>(
  modelOptions: Omit<ModelOptions<N, S, A, V, DM>, '_depends'>,
  depends?: Tuple<DA>
): DefineModel<N, S, A, V, DM> => {
  if (process.env.NODE_ENV === 'development') {
    invariant(
      !depends || Array.isArray(depends),
      `second argument depends should be an array, now is ${typeof depends} !`
    )
    validateModelOptions(modelOptions)
  }

  const model = modelOptions as ModelOptions<N, S, A, V, DM>
  if (depends) {
    model._depends = {}
    for (let index = 0; index < depends.length; index++) {
      const dep = depends[index] as any
      const name: string = dep.name || `${index}`
      model._depends[name] = dep
    }
  }

  return model
}
