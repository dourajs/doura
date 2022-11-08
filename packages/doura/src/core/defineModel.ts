import {
  State,
  Actions,
  ActionOptions,
  ViewOptions,
  ActionThis,
  ViewThis,
  validateModelOptions,
} from './modelOptions'
import { invariant } from '../utils'
import { Math, Tuple, EmptyObject } from '../types'

export type Deps = Record<string, AnyModel>

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
  D extends Deps
> = {
  name?: N
  state: S
  actions?: A & ThisType<ActionThis<S, A, V, D>>
  views?: V & ThisType<ViewThis<S, V, D>>
  _depends?: Deps
}

export type AnyModel = DefineModel<any, any, any, any, any>

export type GetModelName<T> = T extends DefineModel<
  infer Name,
  any,
  any,
  any,
  any
>
  ? Name
  : never

export type GetState<Model> = Model extends DefineModel<
  any,
  infer S,
  any,
  any,
  any
>
  ? { [K in keyof S]: S[K] }
  : never

export type GetActions<Model> = Model extends DefineModel<
  any,
  any,
  infer A,
  any,
  any
>
  ? Actions<A> & EmptyObject
  : never

export type GetModelDeps<T> = T extends DefineModel<
  any,
  any,
  any,
  any,
  infer Deps
>
  ? Deps
  : never

export const defineModel = <
  N extends string,
  S extends State,
  A extends ActionOptions,
  V extends ViewOptions,
  Deps extends MakeDeps<D>,
  D extends any[] = []
>(
  modelOptions: Omit<DefineModel<N, S, A, V, Deps>, '_depends'>,
  depends?: Tuple<D>
) => {
  if (process.env.NODE_ENV === 'development') {
    invariant(
      !depends || Array.isArray(depends),
      `second argument depends should be an array, now is ${typeof depends} !`
    )
    validateModelOptions(modelOptions)
  }

  const model = modelOptions as DefineModel<N, S, A, V, Deps>
  if (depends) {
    model._depends = {}
    for (let index = 0; index < depends.length; index++) {
      const dep = depends[index] as AnyModel
      const name: string = dep.name || `${index}`
      model._depends[name] = dep
    }
  }

  return model
}
