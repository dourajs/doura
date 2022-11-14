import { hasOwn, extend, isPlainObject } from '../utils'
import { warn } from '../warning'
import {
  PublicPropertiesMap,
  ProxyContext,
  AccessContext,
  ActionListener,
} from './model'
import {
  State,
  AnyModel,
  GetModelState,
  GetModelActions,
  GetModelViews,
} from './modelOptions'
import { createView, Selector, ModelView, ModelData } from './view'

export type ModelPublicInstance<IModel extends AnyModel> = {
  $rawState: IModel['state']
  $state: IModel['state']
  $patch(newState: State): void
  $replace(newState: State): void
  $actions: GetModelActions<IModel>
  $views: GetModelViews<IModel>
  $getSnapshot(): ModelData<IModel>
  $createSelector: <R>(
    selector: Selector<IModel, R>
  ) => ModelView<Selector<IModel, R>>
  $onAction: (listener: ActionListener) => void
} & GetModelState<IModel> &
  GetModelViews<IModel> &
  GetModelActions<IModel>

const enum AccessTypes {
  STATE,
  ACTION,
  VIEW,
  CONTEXT,
}

export const publicPropertiesMap: PublicPropertiesMap =
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /*#__PURE__*/ extend(
    (Object.create(null),
    {
      $rawState: (i) => i.getState(),
      $state: (i) => (i.isPrimitiveState ? i.stateRef.value : i.stateValue),
      $patch: (i) => i.patch,
      $actions: (i) => i.actions,
      $views: (i) => i.views,
      $getSnapshot: (i) => i.getSnapshot,
      $createSelector: (i) => createView.bind(null, i),
      $onAction: (i) => i.onAction,
    } as PublicPropertiesMap)
  )

export const PublicInstanceProxyHandlers = {
  get: ({ _: instance }: ProxyContext, key: string) => {
    const {
      actions,
      views,
      accessCache,
      accessContext,
      depsProxy,
      ctx,
      stateValue: state,
    } = instance

    if (key[0] !== '$') {
      const n = accessCache[key]
      if (n !== undefined) {
        switch (n) {
          case AccessTypes.STATE:
            return state[key]
          case AccessTypes.VIEW:
            return views[key]
          case AccessTypes.ACTION:
            if (accessContext === AccessContext.VIEW) {
              return
            }
            return actions[key]
          case AccessTypes.CONTEXT:
            return ctx[key]
          // default: just fallthrough
        }
      } else if (hasOwn(state, key)) {
        accessCache[key] = AccessTypes.STATE
        return state[key]
      } else if (hasOwn(views, key)) {
        accessCache[key] = AccessTypes.VIEW
        return views[key]
      } else if (hasOwn(actions, key)) {
        if (accessContext === AccessContext.VIEW) {
          return
        }
        accessCache[key] = AccessTypes.ACTION
        return actions[key]
      } else if (hasOwn(ctx, key)) {
        accessCache[key] = AccessTypes.CONTEXT
        return ctx[key]
      }
    }

    if (key === '$dep') {
      return depsProxy
    }

    const publicGetter = publicPropertiesMap[key]
    if (publicGetter) {
      return publicGetter(instance)
    } else if (hasOwn(ctx, key)) {
      accessCache[key] = AccessTypes.CONTEXT
      return ctx[key]
    }
    // CAUTION: pinia requires state exist at first, we should consider carefully
    // whether to support this
    // fallback to state, the key may not exist at first
    else if (isPlainObject(state)) {
      // @ts-ignore
      return state[key]
    }
  },

  set({ _: instance }: ProxyContext, key: string, value: any): boolean {
    const {
      ctx,
      actions,
      views,
      accessContext,
      stateRef: { value: state },
    } = instance
    if (accessContext === AccessContext.VIEW) {
      if (process.env.NODE_ENV === 'development') {
        warn(`Cannot change state in view function`, instance)
      }
      return false
    }

    if (hasOwn(state, key)) {
      state[key] = value
      return true
    } else if (key === '$state') {
      if (typeof value === 'bigint' || typeof value === 'symbol') {
        if (process.env.NODE_ENV === 'development') {
          warn("'BigInt' and 'Symbol' are not assignable to the State")
        }
        return false
      }

      // allow to assign $state to replace state
      instance.replace(value)
      return true
    } else if (hasOwn(actions, key)) {
      if (process.env.NODE_ENV === 'development') {
        warn(
          `Attempting to mutate action "${key}". Actions are readonly.`,
          instance
        )
      }
      return false
    } else if (hasOwn(views, key)) {
      if (process.env.NODE_ENV === 'development') {
        warn(
          `Attempting to mutate view "${key}". Views are readonly.`,
          instance
        )
      }
      return false
    }

    if (key[0] === '$' && hasOwn(publicPropertiesMap, key)) {
      if (process.env.NODE_ENV === 'development') {
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

  has({ _: instance }: ProxyContext, key: string) {
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
      key === '$dep' ||
      hasOwn(ctx, key) ||
      hasOwn(publicPropertiesMap, key)
    )
  },
}
