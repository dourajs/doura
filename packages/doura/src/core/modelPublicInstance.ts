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
} from './modelOptions'
import { createView, Selector, ModelView } from './view'

export const isReservedPrefix = (key: string) => key === '_' || key === '$'

export type ModelPublicInstance<IModel extends AnyModel> = {
  $name: string
  $rawState: ModelState<IModel>
  $state: ModelState<IModel>
  $actions: ModelActions<IModel>
  $views: ModelViews<IModel>
  $patch(newState: State): void
  $onAction: (listener: ActionListener) => UnSubscribe
  $subscribe: (listener: SubscriptionCallback) => UnSubscribe
  $isolate: <T>(fn: (s: ModelState<IModel>) => T) => T
  $getApi(): ModelAPI<IModel>
  $createView: <R>(
    selector: Selector<IModel, R>
  ) => ModelView<Selector<IModel, R>>
} & ModelState<IModel> &
  ModelViews<IModel> &
  ModelActions<IModel>

export const publicPropertiesMap: PublicPropertiesMap =
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /*#__PURE__*/ assign(
    (Object.create(null),
    {
      $name: (i) => i.name,
      $rawState: (i) => i.getState(),
      $state: (i) => i.stateValue,
      $actions: (i) => i.actions,
      $views: (i) => i.views,
      $patch: (i) => i.patch,
      $onAction: (i) => i.onAction,
      $subscribe: (i) => i.subscribe,
      $isolate: (i) => i.isolate,
      $getApi: (i) => i.getApi,
      $createView: (i) => createView.bind(null, i),
    } as PublicPropertiesMap)
  )

export const PublicInstanceProxyHandlers: ProxyHandler<ProxyContext> = {
  get: ({ _: instance }, key: string) => {
    const { actions, views, accessCache, ctx, stateValue: state } = instance

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
          // default: just fallthrough
        }
      } else if (hasOwn(state, key)) {
        accessCache[key] = AccessTypes.STATE
        return state[key]
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
  },

  set({ _: instance }, key: string, value: any): boolean {
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
        warn(
          `Attempting to mutate view "${key}". Views are readonly.`,
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
  },

  has({ _: instance }, key: string) {
    const {
      actions,
      views,
      accessCache,
      accessContext,
      ctx,
      stateValue: state,
    } = instance

    return (
      !!accessCache[key] ||
      hasOwn(state, key) ||
      hasOwn(views, key) ||
      (accessContext !== AccessContext.VIEW && hasOwn(actions, key)) ||
      hasOwn(ctx, key) ||
      hasOwn(publicPropertiesMap, key)
    )
  },
}
