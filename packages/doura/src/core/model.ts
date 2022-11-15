import { isPlainObject, hasOwn, isObject, def } from '../utils'
import { warn } from '../warning'
import {
  view as reactiveView,
  View,
  effectScope,
  EffectScope,
  draft,
  watch,
  snapshot,
} from '../reactivity/index'
import {
  Views,
  Action,
  State,
  StateObject,
  AnyModel,
  GetModelActions,
} from './modelOptions'
import {
  ModelPublicInstance,
  PublicInstanceProxyHandlers,
} from './modelPublicInstance'
import { queueJob, SchedulerJob } from './scheduler'

const randomString = () =>
  Math.random().toString(36).substring(7).split('').join('.')

export const ActionTypes = {
  INIT: `@@doura/INIT${/* #__PURE__ */ randomString()}`,
  MODIFY: '@@doura/MODIFY',
  PATCH: '@@doura/PATCH',
}

export type UnSubscribe = () => void

export interface Store {
  getState(): Record<string, State>
  dispatch(action: Action): Action
  subscribe(fn: SubscriptionCallback): UnSubscribe
  destroy(): void
}

export type PublicPropertiesMap = Record<string, (i: ModelInternal) => any>

export interface ProxyContext {
  _: ModelInternal<any>
}

export interface ActionListener {
  (action: Action): any
}

export interface SubscriptionCallback {
  (): any
}

const DepsPublicInstanceProxyHandlers = {
  get: (deps: Map<string, ModelInternal>, key: string) => {
    const model = deps.get(key)
    if (model) {
      return model.proxy
    }

    return undefined
  },
}

export const enum AccessContext {
  DEFAULT,
  VIEW,
}

function patchObj(base: Record<string, any>, patch: Record<string, any>) {
  const keys = Object.keys(patch)
  if (!keys.length) {
    return
  }

  keys.forEach((key) => {
    if (hasOwn(base, key) && isPlainObject(patch[key])) {
      patchObj(base[key], patch[key])
    } else {
      base[key] = patch[key]
    }
  })
}

export class ModelInternal<IModel extends AnyModel = AnyModel> {
  name: string
  options: IModel

  // deps
  deps: Map<string, ModelInternal>
  depsProxy: object

  ctx: Record<string, any>
  accessCache: Record<string, any>

  /**
   * proxy for public this
   */
  proxy: ModelPublicInstance<IModel> | null = null

  // props
  actions: GetModelActions<IModel>
  views: Views<IModel['views']>
  viewInstances: View[] = []
  accessContext: AccessContext

  stateRef: {
    value: IModel['state']
  }
  stateValue!: IModel['state']
  effectScope: EffectScope

  isPrimitiveState!: boolean

  private _snapshot: State | null = null
  private _initState: IModel['state']
  private _currentState!: IModel['state']
  private _actionListeners: Set<ActionListener> = new Set()
  private _viewListeners: Set<() => void> = new Set()
  private _subscribers: Set<SubscriptionCallback> = new Set()
  private _isDispatching: boolean
  private _draftListenerHandler: () => void
  private _watchStateChange: boolean = true

  constructor(model: IModel, initState: State) {
    this.patch = this.patch.bind(this)
    this.getSnapshot = this.getSnapshot.bind(this)
    this.subscribe = this.subscribe.bind(this)
    this.onAction = this.onAction.bind(this)
    this._subscribeFromView = this._subscribeFromView.bind(this)

    this.options = model
    this.name = this.options.name || ''
    this._initState = initState || model.state

    this.effectScope = effectScope()
    this.stateRef = draft({
      value: this._initState,
    })
    const update: SchedulerJob = () => {
      this.dispatch({
        type: ActionTypes.MODIFY,
        payload: snapshot(this.stateRef.value, this.stateRef.value),
      })
    }
    this._draftListenerHandler = watch(this.stateRef, () => {
      if (this._watchStateChange) {
        queueJob(update)
      }
    })

    this.actions = Object.create(null)
    this.views = Object.create(null)
    this.deps = new Map()
    this.accessContext = AccessContext.DEFAULT

    this._isDispatching = false

    this.ctx = {}
    def(this.ctx, '_', this)

    this.accessCache = Object.create(null)
    this.proxy = new Proxy(
      this.ctx,
      PublicInstanceProxyHandlers
    ) as ModelPublicInstance<IModel>

    this.depsProxy = new Proxy(this.deps, DepsPublicInstanceProxyHandlers)

    this._initActions()
    this._initViews()

    this.dispatch({ type: ActionTypes.INIT })
  }

  patch(obj: StateObject) {
    if (!isPlainObject(obj)) {
      if (process.env.NODE_ENV === 'development') {
        warn(
          `$patch argument should be an object, but receive a ${Object.prototype.toString.call(
            obj
          )}`
        )
      }
      return
    }

    if (!this._currentState) {
      return
    }

    this._watchStateChange = false
    patchObj(this.proxy!.$state, obj)
    this._watchStateChange = true

    this.dispatch({
      type: ActionTypes.PATCH,
      payload: snapshot(this.stateRef.value, this.stateRef.value),
    })
  }

  // fixme: use a dedicated replace action for this
  replace(newState: StateObject) {
    this.stateRef.value = newState
    this.stateValue = this.stateRef.value
    // invalid all views;
    for (const view of this.viewInstances) {
      view.effect.scheduler!()
    }
  }

  getState() {
    return this._currentState
  }

  getSnapshot() {
    if (this._snapshot === null) {
      this._snapshot = {
        $state: this._currentState,
        ...this._currentState,
        ...this.views,
      }
    }

    return this._snapshot
  }

  reducer(state: IModel['state'], action: Action) {
    switch (action.type) {
      case ActionTypes.INIT:
        return this._initState
      case ActionTypes.MODIFY:
      case ActionTypes.PATCH:
        return action.payload
      default:
        return state
    }
  }

  dispatch(action: Action) {
    if (typeof action.type === 'undefined') {
      if (process.env.NODE_ENV === 'development') {
        warn(
          `Actions may not have an undefined "type" property. You may have misspelled an action type string constant.`
        )
      }
      return action
    }

    if (this._isDispatching) {
      if (process.env.NODE_ENV === 'development') {
        warn(`Cannot dispatch action from a reducer.`)
      }
      return action
    }

    for (const listener of this._actionListeners) {
      listener(action)
    }

    let nextState

    try {
      this._isDispatching = true
      nextState = this.reducer(this._currentState, action)
    } finally {
      this._isDispatching = false
    }
    if (nextState !== this._currentState) {
      this._snapshot = null
      this._currentState = nextState
      this.isPrimitiveState = !isObject(nextState)
      this.stateValue = this.stateRef.value
      // trigger self _subscribers
      this._triggerListener()
    }

    return action
  }

  onAction(listener: (action: Action) => any) {
    this._actionListeners.add(listener)

    return () => {
      this._actionListeners.delete(listener)
    }
  }

  subscribe(listener: () => void) {
    this._subscribers.add(listener)

    return () => {
      this._subscribers.delete(listener)
    }
  }

  destroy() {
    this._currentState = null
    this.stateRef = {
      value: null,
    }
    this._subscribers.clear()
    this.effectScope.stop()
    this._draftListenerHandler()
  }

  depend(name: string, dep: ModelInternal<any>) {
    this.deps.set(name, dep)
    // collection beDepends, a depends b, when b update, call a need trigger listener
    dep.subscribe(() => {
      this._triggerListener()
    })
  }

  private _triggerListener() {
    // view's listeners should be triggered first
    for (const listener of this._viewListeners) {
      listener()
    }
    for (const listener of this._subscribers) {
      listener()
    }
  }

  createView(viewFn: (s: IModel['state']) => any) {
    let view: View
    this.effectScope.run(() => {
      view = reactiveView(() => {
        const oldCtx = this.accessContext
        this.accessContext = AccessContext.VIEW
        try {
          let value = viewFn.call(this.proxy, this.proxy)
          if (process.env.NODE_ENV === 'development') {
            if (isObject(value)) {
              if (value === this.proxy) {
                warn(
                  `detect returning "this" in view, it would cause unpected behavior`
                )
              } else if (value === this.proxy!.$state) {
                warn(
                  `detect returning "this.$state" in view, it would cause unpected behavior`
                )
              }
            }
          }
          return value
        } finally {
          this.accessContext = oldCtx
        }
      })
    })

    this.viewInstances.push(view!)
    return view!
  }

  private _initActions() {
    // map actions names to dispatch actions
    const actions = this.options.actions
    if (actions) {
      const actionKeys = Object.keys(actions)
      actionKeys.forEach((actionsName) => {
        const action = actions[actionsName]

        // @ts-ignore
        this.actions[actionsName as string] = (...args: any[]) => {
          return action.call(this.proxy, ...args)
        }
      })
    }
  }

  private _initViews() {
    const views = this.options.views
    if (views) {
      for (const viewName of Object.keys(views)) {
        const viewFn = views[viewName]
        const view = this.createView(viewFn)

        const self = this
        Object.defineProperty(this.views, viewName, {
          configurable: true,
          enumerable: true,
          get() {
            // todo: fix dep.$state got collected by parent view
            const viewWithState = view as View & { __pre: any; __snapshot: any }
            let value = view.value
            if (view.mightChange) {
              view.mightChange = false
              viewWithState.__snapshot = snapshot(value, self.stateRef.value)
            } else if (viewWithState.__pre !== value) {
              viewWithState.__snapshot = snapshot(value, self.stateRef.value)
            }
            viewWithState.__pre = value

            return viewWithState.__snapshot
          },
          set() {
            if (process.env.NODE_ENV === 'development') {
              warn(`cannot change view property '${String(viewName)}'`)
            }
            return false
          },
        })
      }
    }
  }

  private _subscribeFromView(listener: () => void) {
    this._viewListeners.add(listener)

    return () => {
      this._viewListeners.delete(listener)
    }
  }
}

export function createModelInstnace<IModel extends AnyModel>(
  modelOptions: IModel,
  initState: State
) {
  return new ModelInternal<IModel>(modelOptions, initState)
}
