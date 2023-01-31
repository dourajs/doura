import { isPlainObject, hasOwn, isObject, def, emptyArray } from '../utils'
import { warn } from '../warning'
import {
  view as reactiveView,
  View,
  effectScope,
  EffectScope,
  draft,
  watch,
  snapshot,
  pauseTracking,
  resetTracking,
  isModified,
} from '../reactivity'
import {
  Views,
  State,
  AnyModel,
  AnyObjectModel,
  ModelState,
  ModelActions,
  ModelViews,
  validateModelOptions,
} from './modelOptions'
import {
  ModelPublicInstance,
  PublicInstanceProxyHandlers,
} from './modelPublicInstance'
import { queueJob, SchedulerJob } from './scheduler'
import { AnyObject } from '../types'
import { Drafted } from '../reactivity/common'

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

export const enum AccessContext {
  DEFAULT,
  VIEW,
}

export const enum AccessTypes {
  STATE,
  ACTION,
  VIEW,
  CONTEXT,
}

export type ModelData<Model extends AnyModel> = ModelState<Model> &
  ModelViews<Model>

export type ModelAPI<IModel extends AnyModel> = ModelData<IModel> &
  ModelActions<IModel>

type ViewExts = View & {
  __pre: any
  __snapshot: any
  __externalArgs?: any[]
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

export interface ModelInternalOptions {
  name?: string
  initState?: State
}

function markViewShouldRun(view: View) {
  view.dirty = true
}

export class ModelInternal<IModel extends AnyObjectModel = AnyObjectModel> {
  name: string
  options: IModel

  ctx: Record<string, any>
  accessCache: Record<string, AccessTypes>

  /**
   * proxy for public this
   */
  proxy: ModelPublicInstance<IModel>

  // props
  actions: ModelActions<IModel>
  views: Views<ModelViews<IModel>>
  viewInstances: View[] = []
  accessContext: AccessContext

  stateRef: {
    value: any
  }
  stateValue!: any
  effectScope: EffectScope

  private _actionDepth = 0
  private _api: ModelAPI<IModel> | null = null
  private _initState: ModelState<IModel>
  private _currentState: any
  private _actionListeners: Set<ActionListener> = new Set()
  private _subscribers: Set<SubscriptionCallback> = new Set()
  private _depListenersHandlers: UnSubscribe[] = []
  private _isDispatching: boolean
  private _draftListenerHandler: () => void
  private _watchStateChange: boolean = true
  private _destroyed: boolean = false

  constructor(model: IModel, { name, initState }: ModelInternalOptions) {
    this.patch = this.patch.bind(this)
    this.onAction = this.onAction.bind(this)
    this.subscribe = this.subscribe.bind(this)
    this.isolate = this.isolate.bind(this)
    this.getApi = this.getApi.bind(this)

    this.options = model
    this.name = name || ''
    this._isDispatching = false
    this._initState = initState || model.state
    this.stateRef = draft({
      value: this._initState,
    })
    const update: SchedulerJob = this._update.bind(this)
    this._draftListenerHandler = watch(this.stateRef, () => {
      if (this._watchStateChange) {
        queueJob(update)
      }
    })
    this._setState(this._initState)

    this.actions = Object.create(null)
    this.views = Object.create(null)
    this.accessContext = AccessContext.DEFAULT
    this.ctx = {}
    def(this.ctx, '_', this)
    this.accessCache = Object.create(null)
    this.proxy = new Proxy(
      this.ctx,
      PublicInstanceProxyHandlers
    ) as ModelPublicInstance<IModel>

    this.effectScope = effectScope()
    this._initActions()
    this._initViews()
  }

  patch(obj: AnyObject) {
    if (!isPlainObject(obj)) {
      if (__DEV__) {
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
    patchObj(this.proxy.$state, obj)
    this._watchStateChange = true

    this.dispatch({
      type: ActionType.PATCH,
      payload: snapshot(this.stateRef.value, this.stateRef.value),
      args: {
        patch: obj,
      },
    })
  }

  replace(newState: AnyObject) {
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

  getApi() {
    if (this._api === null) {
      const data = (this._api = {
        ...this._currentState,
        ...this.views,
      })
      for (const action of Object.keys(this.actions)) {
        def(data, action, (this.actions as any)[action])
      }
    }

    return this._api
  }

  onAction(listener: (action: ModelAction) => any) {
    this._actionListeners.add(listener)

    return () => {
      this._actionListeners.delete(listener)
    }
  }

  subscribe(listener: SubscriptionCallback): UnSubscribe {
    this._subscribers.add(listener)

    return () => {
      this._subscribers.delete(listener)
    }
  }

  /**
   * Executes the given function in a scope where reactive values can be read,
   * but they cannot cause the reactive scope of the caller to be re-evaluated
   * when they change
   */
  isolate<T>(fn: (s: ModelState<IModel>) => T): T {
    pauseTracking()
    const res = fn(this.stateValue)
    resetTracking()
    return res
  }

  depend(dep: ModelInternal<any>) {
    // emit change when dependencies change.
    this._depListenersHandlers.push(
      dep.subscribe((event) => {
        this._triggerListener({
          ...event,
          model: this.proxy,
        })
      })
    )
  }

  createView(viewFn: (s: ModelState<IModel>) => any) {
    let view: View
    this.effectScope.run(() => {
      view = reactiveView(() => {
        const oldCtx = this.accessContext
        this.accessContext = AccessContext.VIEW
        const externalArgs = (view as ViewExts).__externalArgs
        try {
          let value = viewFn.call(
            this.proxy,
            this.proxy,
            ...(externalArgs ? (externalArgs as []) : emptyArray)
          )
          if (__DEV__) {
            if (isObject(value)) {
              if (value === this.proxy) {
                warn(
                  `detected that "self" is returned in view, it would cause unpected behavior`
                )
              } else if (value === this.proxy.$state) {
                warn(
                  `detected that "$state" is returned in view, it would cause unpected behavior`
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

  reducer(state: ModelState<AnyModel>, action: Action) {
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
      if (__DEV__) {
        warn(
          `Actions may not have an undefined "type" property. You may have misspelled an action type string constant.`
        )
      }
      return action
    }

    if (this._isDispatching) {
      if (__DEV__) {
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
        model: this.proxy,
        target: this.proxy,
        ...action.args,
      })
    }

    return action
  }

  destroy() {
    // reset props
    this._destroyed = true
    this._api = null

    this._currentState = null
    this.stateRef = {
      value: null,
    }
    this._subscribers.clear()
    this.effectScope.stop()

    // clear subscriptions
    for (const unsub of this._depListenersHandlers) {
      unsub()
    }
    this._draftListenerHandler()
  }

  private _setState(newState: ModelState<IModel>) {
    this._api = null
    this._currentState = newState
    this.stateValue = this.stateRef.value
  }

  private _update() {
    if (this._destroyed || !isModified(this.stateRef as any as Drafted)) {
      return
    }

    this.dispatch({
      type: ActionType.MODIFY,
      payload: snapshot(this.stateRef.value, this.stateRef as any as Drafted),
    })
  }

  private _triggerListener(event: ModelChangeEvent) {
    for (const listener of this._subscribers) {
      listener(event)
    }
  }

  private _initActions() {
    // map actions names to dispatch actions
    const actions = this.options.actions
    if (actions) {
      for (const actionName of Object.keys(actions)) {
        this.accessCache[actionName] = AccessTypes.ACTION
        const action = actions[actionName]

        Object.defineProperty(this.actions, actionName, {
          configurable: true,
          enumerable: true,
          writable: false,
          value: (...args: any[]) => {
            if (this.accessContext === AccessContext.VIEW) {
              if (__DEV__) {
                warn(
                  `Action "${String(
                    actionName
                  )}" is called in view function, it will be ignored and has no effect.`
                )
              }
              return
            }

            this._actionDepth++
            let res: any
            try {
              for (const listener of this._actionListeners) {
                listener({
                  name: actionName,
                  args,
                })
              }
              res = action.call(this.proxy, ...args)
            } finally {
              // flush changes to model synchronously right after an action.
              // this prevent issues like https://github.com/pmndrs/valtio/issues/270
              --this._actionDepth === 0 && this._update()
            }

            return res
          },
        })
      }
    }
  }

  private _initViews() {
    const views = this.options.views
    if (views) {
      for (const viewName of Object.keys(views)) {
        this.accessCache[viewName] = AccessTypes.VIEW
        const viewFn = views[viewName]
        const hasExternalArgs = viewFn.length > 1
        const view = this.createView(viewFn)
        const viewWithState = view as ViewExts
        const getViewResult = () => {
          let value = view.value
          if (view.mightChange) {
            view.mightChange = false
            viewWithState.__snapshot = snapshot(value, this.stateRef.value)
          } else if (viewWithState.__pre !== value) {
            viewWithState.__snapshot = snapshot(value, this.stateRef.value)
          }
          viewWithState.__pre = value

          return viewWithState.__snapshot
        }
        const getResult = hasExternalArgs
          ? () =>
              (...args: any[]) => {
                const oldArgs = viewWithState.__externalArgs
                if (!oldArgs) {
                  markViewShouldRun(view)
                } else if (oldArgs.length !== args.length) {
                  markViewShouldRun(view)
                } else {
                  for (let i = 0; i < oldArgs.length; i++) {
                    if (oldArgs[i] !== args[i]) {
                      markViewShouldRun(view)
                      break
                    }
                  }
                }
                viewWithState.__externalArgs = args
                return getViewResult()
              }
          : getViewResult
        Object.defineProperty(this.views, viewName, {
          configurable: true,
          enumerable: true,
          get() {
            return getResult()
          },
          set() {
            if (__DEV__) {
              warn(`cannot change view property '${String(viewName)}'`)
            }
            return false
          },
        })
      }
    }
  }
}

export function createModelInstnace<IModel extends AnyObjectModel>(
  modelOptions: IModel,
  options: ModelInternalOptions = {}
) {
  if (__DEV__) {
    validateModelOptions(modelOptions)
  }

  return new ModelInternal<IModel>(modelOptions, options)
}
