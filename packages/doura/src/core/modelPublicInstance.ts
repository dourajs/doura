import { hasOwn, assign } from '../utils'
import { warn } from '../warning'
import {
  type PublicPropertiesMap,
  type ProxyContext,
  AccessContext,
  type ActionListener,
  type SubscriptionCallback,
  type UnSubscribe,
  type ModelAPI,
  AccessTypes,
} from './model'
import type {
  State,
  Model,
  ModelDefinition,
  ModelState,
  ModelActions,
  ModelViews,
  ModelQueries,
  ModelModels,
  ModelQueryMethods,
} from './modelOptions'
import type { ModelPublicFields } from './modelApi'
import { createView, type Selector, type ModelView } from './view'

const isReservedPrefix = (key: string) => key === '_' || key === '$'

export type ModelInstance<
  ModelDef extends ModelDefinition<Model> = ModelDefinition<Model>,
> = {
  $name: string
  $rawState: ModelState<ModelDef>
  $state: ModelState<ModelDef>
  $actions: ModelActions<ModelDef>
  $views: ModelViews<ModelDef>
  $queries: ModelQueries<ModelDef>
  $models: ModelModels<ModelDef>
  $patch(newState: State): void
  $onAction: (listener: ActionListener) => UnSubscribe
  $subscribe: (listener: SubscriptionCallback) => UnSubscribe
  $isolate: <T>(fn: (s: ModelState<ModelDef>) => T) => T
  $getApi(): ModelAPI<ModelDef>
  $createView: <R>(
    selector: Selector<ModelDef, R>
  ) => ModelView<Selector<ModelDef, R>>
} & ModelQueryMethods &
  ModelPublicFields<ModelDef>

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
      $models: (i) => i.models,
      $patch: (i) => i.patch,
      $onAction: (i) => i.onAction,
      $subscribe: (i) => i.subscribe,
      $isolate: (i) => i.isolate,
      $getApi: (i) => i.getApi,
      $createView: (i) => createView.bind(null, i),
      $invalidateQueries: (i) => () => i.invalidateQueries(),
      $cancelQueries: (i) => () => i.cancelQueries(),
      $resetQueries: (i) => () => i.resetQueries(),
    } as PublicPropertiesMap
  )

const createGetter =
  (isPublicInstance: boolean) =>
  ({ _: instance }: ProxyContext, key: string) => {
    const { views, actions, queries, queryFetches, accessCache, ctx, models } =
      instance

    let state: any
    if (isPublicInstance) {
      state = instance.getState()
    } else {
      state = instance.stateValue
    }

    if (key[0] !== '$') {
      if (hasOwn(state, key)) {
        if (accessCache[key] === undefined) {
          accessCache[key] = AccessTypes.STATE
        }
        return state[key]
      }

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
            return queryFetches[key]
          case AccessTypes.MODEL:
            return isPublicInstance ? models[key] : instance.modelProxies[key]
          // default: just fallthrough
        }
      } else if (hasOwn(models, key)) {
        accessCache[key] = AccessTypes.MODEL
        return isPublicInstance ? models[key] : instance.modelProxies[key]
      } else if (hasOwn(views, key)) {
        accessCache[key] = AccessTypes.VIEW
        return views[key]
      } else if (hasOwn(actions, key)) {
        accessCache[key] = AccessTypes.ACTION
        return actions[key]
      } else if (hasOwn(queries, key)) {
        accessCache[key] = AccessTypes.QUERY
        return queryFetches[key]
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

    if (__DEV__ && isReservedPrefix(key[0]) && hasOwn(state, key)) {
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
    models,
    views,
    actions,
    queries,
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
  } else if (hasOwn(models, key)) {
    if (__DEV__) {
      warn(
        `Attempting to mutate model "${key}". Models are readonly.`,
        instance
      )
    }
    return false
  } else if (hasOwn(views, key)) {
    if (__DEV__) {
      warn(`Attempting to mutate view "${key}". Views are readonly.`, instance)
    }
    return false
  } else if (hasOwn(actions, key)) {
    if (__DEV__) {
      warn(
        `Attempting to mutate action "${key}". Actions are readonly.`,
        instance
      )
    }
    return false
  } else if (hasOwn(queries, key)) {
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
