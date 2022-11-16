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

// const randomString = () =>
//   Math.random().toString(36).substring(7).split('').join('.')

export enum ActionType {
  REPLACE = 'replace',
  MODIFY = 'modify',
  PATCH = 'patch',
}

export type UnSubscribe = () => void

export type PublicPropertiesMap = Record<string, (i: ModelInternal) => any>

export interface ProxyContext {
  _: ModelInternal<any>
}

export interface ModelAction {
  name: string
  args: any[]
}

export interface ActionListener {
  (action: ModelAction): any
}

export interface SubscriptionCallback {
  (event: ModelChangeEvent): any
}

export interface ActionBase<T = any> {
  type: string
  payload?: T
  // Allows any extra properties to be defined in an action.
  [extraProps: string]: any
}

export interface ModifyAction extends ActionBase {
  type: ActionType.MODIFY
}

export type PatchArgs = {
  patch: any
}

export interface PatchAction extends ActionBase {
  type: ActionType.PATCH
  args: PatchArgs
}

export interface ReplaceAction extends ActionBase {
  type: ActionType.REPLACE
}

export type Action = ModifyAction | PatchAction | ReplaceAction

export interface ModelChangeEventBase {
  type: ActionType
  // the model to which the event is attached.
  model: ModelPublicInstance<AnyModel>
  // the model that triggered the event.
  target: ModelPublicInstance<AnyModel>
}

export interface ModelModifyEvent extends ModelChangeEventBase {
  type: ActionType.MODIFY
}

export interface ModelPatchEvent extends ModelChangeEventBase, PatchArgs {
  type: ActionType.PATCH
}

export interface ModelReplaceEvent extends ModelChangeEventBase {
  type: ActionType.REPLACE
}

export type ModelChangeEvent =
  | ModelModifyEvent
  | ModelPatchEvent
  | ModelReplaceEvent

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
        type: ActionType.MODIFY,
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

    this._setState(this._initState)
  }

  patch(obj: StateObject) {
    if (!isPlainObject(obj)) {
      if (process.env.NODE_ENV === 'development') {
        warn(
          `patch argument should be an object, but receive a ${Object.prototype.toString.call(
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
      type: ActionType.PATCH,
      payload: snapshot(this.stateRef.value, this.stateRef.value),
      args: {
        patch: obj,
      },
    })
  }

  replace(newState: StateObject) {
    this._watchStateChange = false
    this.stateRef.value = newState
    this._watchStateChange = true

    // invalid all views;
    for (const view of this.viewInstances) {
      view.effect.scheduler!()
    }

    this.dispatch({
      type: ActionType.REPLACE,
      payload: newState,
    })
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
      case ActionType.REPLACE:
      case ActionType.MODIFY:
      case ActionType.PATCH:
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

    let nextState

    try {
      this._isDispatching = true
      nextState = this.reducer(this._currentState, action)
    } finally {
      this._isDispatching = false
    }
    if (nextState !== this._currentState) {
      this._setState(nextState)
      this._triggerListener({
        type: action.type,
        model: this.proxy!,
        target: this.proxy!,
        ...action.args,
      })
    }

    return action
  }

  onAction(listener: (action: ModelAction) => any) {
    this._actionListeners.add(listener)

    return () => {
      this._actionListeners.delete(listener)
    }
  }

  subscribe(listener: SubscriptionCallback) {
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
    dep.subscribe((event) => {
      this._triggerListener({
        ...event,
        model: this.proxy!,
      })
    })
  }

  private _setState(newState: IModel['state']) {
    this._snapshot = null
    this._currentState = newState
    this.isPrimitiveState = !isObject(newState)
    this.stateValue = this.stateRef.value
  }

  private _triggerListener(event: ModelChangeEvent) {
    // view's listeners should be triggered first
    for (const listener of this._viewListeners) {
      listener()
    }
    for (const listener of this._subscribers) {
      listener(event)
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
          for (const listener of this._actionListeners) {
            listener({
              name: actionsName,
              args,
            })
          }

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
