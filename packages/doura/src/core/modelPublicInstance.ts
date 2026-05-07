import { hasOwn, assign } from '../utils'
import { warn } from '../warning'
import {
  PublicPropertiesMap,
  ProxyContext,
  AccessContext,
  ActionListener,
  SubscriptionCallback,
  UnSubscribe,
  ModelAPI,
  AccessTypes,
} from './model'
import {
  State,
  AnyModel,
  ModelState,
  ModelActions,
  ModelViews,
  ModelQueries,
  StripIndexSignature,
} from './modelOptions'
import { createView, Selector, ModelView } from './view'

const isReservedPrefix = (key: string) => key === '_' || key === '$'

/** Names of declared queries on a model (string keys only). Falls back
 *  to `string` when ModelQueries resolves to an empty object so external
 *  call sites that don't know the model's queries still type-check. */
type ModelQueryName<IModel extends AnyModel> =
  keyof ModelQueries<IModel> extends never
    ? string
    : Extract<keyof ModelQueries<IModel>, string>

export type ModelPublicInstance<IModel extends AnyModel> = {
  $name: string
  $rawState: ModelState<IModel>
  $state: ModelState<IModel>
  $actions: ModelActions<IModel>
  $views: ModelViews<IModel>
  $queries: ModelQueries<IModel>
  $patch(newState: State): void
  $onAction: (listener: ActionListener) => UnSubscribe
  $subscribe: (listener: SubscriptionCallback) => UnSubscribe
  $isolate: <T>(fn: (s: ModelState<IModel>) => T) => T
  $getApi(): ModelAPI<IModel>
  $createView: <R>(
    selector: Selector<IModel, R>
  ) => ModelView<Selector<IModel, R>>
  $invalidateQueries<N extends ModelQueryName<IModel>>(
    queryName?: N,
    args?: object
  ): void
  $cancelQueries<N extends ModelQueryName<IModel>>(
    queryName?: N,
    args?: object
  ): void
  $resetQueries<N extends ModelQueryName<IModel>>(
    queryName?: N,
    args?: object
  ): void
  $setQueryData<N extends ModelQueryName<IModel>>(
    queryName: N,
    args: object | void,
    data: unknown
  ): void
  $getQueryData<N extends ModelQueryName<IModel>>(
    queryName: N,
    args?: object | void
  ): unknown | undefined
  $prefetchQuery<N extends ModelQueryName<IModel>>(
    queryName: N,
    args?: object | void
  ): Promise<void>
} & StripIndexSignature<ModelState<IModel>> &
  StripIndexSignature<ModelViews<IModel>> &
  StripIndexSignature<ModelActions<IModel>> &
  StripIndexSignature<ModelQueries<IModel>>

const publicPropertiesMap: PublicPropertiesMap =
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /*#__PURE__*/ assign(
    Object.create(null) as PublicPropertiesMap,
    {
      $name: (i) => i.name,
      $rawState: (i) => i.getState(),
      $state: (i) => i.stateValue,
      $actions: (i) => i.actions,
      $views: (i) => i.views,
      $queries: (i) => i.queries,
      $patch: (i) => i.patch,
      $onAction: (i) => i.onAction,
      $subscribe: (i) => i.subscribe,
      $isolate: (i) => i.isolate,
      $getApi: (i) => i.getApi,
      $createView: (i) => createView.bind(null, i),
      $invalidateQueries: (i) => i.invalidateQueries.bind(i),
      $setQueryData: (i) => i.setQueryData.bind(i),
      $getQueryData: (i) => i.getQueryData.bind(i),
      $prefetchQuery: (i) => i.prefetchQuery.bind(i),
      $cancelQueries: (i) => i.cancelQueries.bind(i),
      $resetQueries: (i) => i.resetQueries.bind(i),
    } as PublicPropertiesMap
  )

const createGetter =
  (isPublicInstance: boolean) =>
  ({ _: instance }: ProxyContext, key: string) => {
    const { actions, views, accessCache, ctx } = instance

    let state: any
    if (isPublicInstance) {
      state = instance.getState()
    } else {
      state = instance.stateValue
    }

    if (key[0] !== '$') {
      const n = accessCache[key]
      if (n !== undefined) {
        switch (n) {
          case AccessTypes.STATE:
            return state[key]
          case AccessTypes.VIEW:
            return views[key]
          case AccessTypes.ACTION:
            return actions[key]
          case AccessTypes.CONTEXT:
            return ctx[key]
          case AccessTypes.QUERY:
            return instance.queries[key]
          // default: just fallthrough
        }
      } else if (hasOwn(state, key)) {
        accessCache[key] = AccessTypes.STATE
        return state[key]
      } else if (hasOwn(instance.queries, key)) {
        accessCache[key] = AccessTypes.QUERY
        return instance.queries[key]
      } else if (hasOwn(ctx, key)) {
        accessCache[key] = AccessTypes.CONTEXT
        return ctx[key]
      }
    }

    const publicGetter = publicPropertiesMap[key]
    if (publicGetter) {
      return publicGetter(instance)
    } else if (hasOwn(ctx, key)) {
      accessCache[key] = AccessTypes.CONTEXT
      return ctx[key]
    }

    if (isReservedPrefix(key[0]) && hasOwn(state, key)) {
      warn(
        `Property ${JSON.stringify(
          key
        )} must be accessed via $state because it starts with a reserved ` +
          `character ("$" or "_") and is not proxied on the render context.`
      )
    }
  }

const set = (
  { _: instance }: ProxyContext,
  key: string,
  value: any
): boolean => {
  const {
    ctx,
    actions,
    views,
    accessContext,
    stateRef: { value: state },
  } = instance
  if (hasOwn(state, key)) {
    if (accessContext === AccessContext.VIEW) {
      if (__DEV__) {
        warn(
          `Attempting to change state "${key}". State are readonly in "views".`,
          instance
        )
      }
      return false
    }

    state[key] = value
    return true
  } else if (hasOwn(actions, key)) {
    if (__DEV__) {
      warn(
        `Attempting to mutate action "${key}". Actions are readonly.`,
        instance
      )
    }
    return false
  } else if (hasOwn(views, key)) {
    if (__DEV__) {
      warn(`Attempting to mutate view "${key}". Views are readonly.`, instance)
    }
    return false
  } else if (hasOwn(instance.queries, key)) {
    if (__DEV__) {
      warn(
        `Attempting to mutate query "${key}". Queries are readonly.`,
        instance
      )
    }
    return false
  }

  if (key === '$state') {
    if (typeof value === 'bigint' || typeof value === 'symbol') {
      if (__DEV__) {
        warn("'BigInt' and 'Symbol' are not assignable to the State")
      }
      return false
    }

    // allow to assign $state to replace state
    instance.replace(value)
    return true
  } else if (key[0] === '$' && hasOwn(publicPropertiesMap, key)) {
    if (__DEV__) {
      warn(
        `Attempting to mutate public property "${key}". ` +
          `Properties starting with $ are reserved and readonly.`,
        instance
      )
    }
    return false
  } else {
    ctx[key] = value
  }

  return true
}

export const InternalInstanceProxyHandlers: ProxyHandler<ProxyContext> = {
  get: createGetter(false),
  set,
}

export const PublicInstanceProxyHandlers: ProxyHandler<ProxyContext> = {
  get: createGetter(true),
  set,
}
