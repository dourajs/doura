import {
  isPlainObject,
  hasOwn,
  isObject,
  def,
  NOOP,
  emptyArray,
  removeUnordered,
} from '../utils'
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
  markUnchanged,
  resetDraftChildren,
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
  ModelInstance,
  InternalInstanceProxyHandlers,
  PublicInstanceProxyHandlers,
} from './modelPublicInstance'
import type { ModelPublicFields } from './modelApi'
import { queueJob, queuePostJob, invalidateJob } from './scheduler'
import { AnyObject } from '../types'
import {
  FetchStatus,
  IQueryCoordinator,
  QueryCacheEntry,
  QueryHash,
} from './queryTypes'
import { isQuerySpecLike, NormalizedQuerySpec } from './queryOptions'
import type { InternalQueryHandle } from './internalQueryTypes'
import { computeQueryHash, computeArgsKey } from './queryUtils'
import { QueryHashIndex, QueryHashPrefixKey } from './queryHashIndex'

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
  model: ModelInstance<AnyModel>
  // the model that triggered the event.
  target: ModelInstance<AnyModel>
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
  QUERY,
  MODEL,
}

export type ModelData<Model extends AnyModel> = ModelState<Model> &
  ModelViews<Model>

export type ModelAPI<IModel extends AnyModel> = ModelPublicFields<IModel>

type ViewExt = View & {
  getSnapshot(): any
  __pre: any
  __snapshot: any
}

function patchObj(base: Record<string, any>, patch: Record<string, any>) {
  const keys = Object.keys(patch)
  if (!keys.length) {
    return
  }

  keys.forEach((key) => {
    if (
      hasOwn(base, key) &&
      isPlainObject(patch[key]) &&
      isPlainObject(base[key])
    ) {
      patchObj(base[key], patch[key])
    } else {
      base[key] = patch[key]
    }
  })
}

export interface ModelInternalOptions {
  name?: string
  initState?: State
  models?: Record<string, ModelInstance<any>>
  modelProxies?: Record<string, ModelInstance<any>>
}

let detachedModelQueryScopeId = 0

export class ModelInternal<IModel extends AnyObjectModel = AnyObjectModel> {
  name: string
  options: IModel

  ctx: Record<string, any>
  accessCache: Record<string, AccessTypes>

  /**
   * proxy for this in the context of views and actions
   */
  proxy: ModelInstance<IModel>

  /**
   * proxy this public api
   */
  publicInst: ModelInstance<IModel>

  // props
  actions: ModelActions<IModel>
  views: Views<ModelViews<IModel>>
  queries: Record<string, InternalQueryHandle>
  models: Record<string, ModelInstance<any>>
  modelProxies: Record<string, ModelInstance<any>>
  viewInstances: ViewExt[] = []
  private _modelViews: ViewExt[] = []
  accessContext: AccessContext

  stateRef: {
    value: any
  }
  stateValue!: any
  effectScope: EffectScope

  private _actionDepth = 0
  private _api: ModelAPI<IModel> | null = null
  private _actionKeys: string[] = []
  private _queryKeys: string[] = []
  private _modelKeys: string[] = []
  private _initState: ModelState<IModel>
  private _currentState: any
  private _actionListeners: ActionListener[] = []
  private _subscribers: SubscriptionCallback[] = []
  private _depListenersHandlers: UnSubscribe[] = []
  private _onDestroyHandlers: (() => void)[] = []
  private _isDispatching: boolean
  private _draftListenerHandler: () => void
  private _watchStateChange: boolean = true
  private _destroyed: boolean = false
  private _lastDraftToSnapshot: WeakMap<object, any> = new WeakMap()
  private _queryHashScope: string

  // Query infrastructure
  coordinator: IQueryCoordinator | undefined = undefined
  queryCache: Map<QueryHash, QueryCacheEntry> = new Map()
  queryNotifiers: Map<QueryHash, (() => void)[]> = new Map()
  private _pendingQueryNotifierHashes: Set<QueryHash> = new Set()
  private _queryIndex = new QueryHashIndex<null>()

  constructor(
    model: IModel,
    { name, initState, models, modelProxies }: ModelInternalOptions
  ) {
    this.patch = this.patch.bind(this)
    this.onAction = this.onAction.bind(this)
    this.subscribe = this.subscribe.bind(this)
    this.isolate = this.isolate.bind(this)
    this.getApi = this.getApi.bind(this)
    this._update = this._update.bind(this)
    this._flushQueryListeners = this._flushQueryListeners.bind(this)

    this.options = model
    this.name = name || ''
    this._queryHashScope = name || `@@detached:${++detachedModelQueryScopeId}`
    this._isDispatching = false
    this._initState = initState || model.state
    this.stateRef = draft({
      value: this._initState,
    })
    ;(this._update as any).__name = name
    this._draftListenerHandler = watch(this.stateRef, () => {
      if (this._watchStateChange) {
        queueJob(this._update)
      }
    })
    this._setState(this._initState)

    this.actions = Object.create(null)
    this.views = Object.create(null)
    this.queries = Object.create(null)
    this.models = models || Object.create(null)
    this.modelProxies = modelProxies || this.models
    this.accessContext = AccessContext.DEFAULT
    this.ctx = {}
    def(this.ctx, '_', this)
    this.accessCache = Object.create(null)
    this.proxy = new Proxy(
      this.ctx,
      InternalInstanceProxyHandlers
    ) as ModelInstance<IModel>
    this.publicInst = new Proxy(
      this.ctx,
      PublicInstanceProxyHandlers
    ) as ModelInstance<IModel>

    this.effectScope = effectScope()
    this._initModels()
    this._initViews()
    this._initActions()
    this._initQueries()
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
      args: {
        patch: obj,
      },
    })
  }

  replace(newState: AnyObject) {
    if (!isObject(newState)) {
      if (__DEV__) {
        warn(
          `replace argument should be an object, but receive a ${Object.prototype.toString.call(
            newState
          )}`
        )
      }
      return
    }

    this._watchStateChange = false
    this.stateRef.value = newState
    this._watchStateChange = true

    // Clear old draft children to prevent accumulation from previous state trees
    resetDraftChildren(this.stateRef as any)

    // Invalidate lazily-cached STATE entries — the state shape may have changed.
    // ACTION and VIEW entries are set once at construction and remain valid.
    for (const key in this.accessCache) {
      if (this.accessCache[key] === AccessTypes.STATE) {
        delete this.accessCache[key]
      }
    }

    // invalid all views;
    for (const view of this.viewInstances) {
      view.effect.scheduler!()
    }

    this._lastDraftToSnapshot = new WeakMap()

    this.dispatch({
      type: ActionType.REPLACE,
      payload: newState,
    })
  }

  getState() {
    return this._currentState
  }

  getApi() {
    // Invalidate cache if any model-defined view is dirty (e.g. from
    // cross-model dependency changes that bypass _setState).
    if (this._api !== null) {
      for (let i = 0; i < this._modelViews.length; i++) {
        if (this._modelViews[i].dirty) {
          this._api = null
          break
        }
      }
    }

    if (this._api === null) {
      const data = (this._api = {
        ...this._currentState,
        ...this.views,
      })

      // Actions and queries are immutable over the model's lifetime —
      // iterate pre-cached keys (built during _initActions/_initQueries).
      for (let i = 0; i < this._queryKeys.length; i++) {
        const key = this._queryKeys[i]
        def(data, key, (this.queries as any)[key])
      }
      for (let i = 0; i < this._actionKeys.length; i++) {
        const key = this._actionKeys[i]
        def(data, key, (this.actions as any)[key])
      }
      for (let i = 0; i < this._modelKeys.length; i++) {
        const key = this._modelKeys[i]
        def(data, key, this.models[key])
      }
    }

    return this._api
  }

  onAction(listener: (action: ModelAction) => any) {
    this._actionListeners.push(listener)

    return () => {
      removeUnordered(this._actionListeners, listener)
    }
  }

  subscribe(listener: SubscriptionCallback): UnSubscribe {
    this._subscribers.push(listener)

    return () => {
      removeUnordered(this._subscribers, listener)
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
    const unsub = dep.subscribe((event) => {
      this._triggerListener({
        ...event,
        model: this.proxy as any,
      })
    })
    this._depListenersHandlers.push(unsub)

    // When child is destroyed before parent, clean up the stale handler
    // so the parent doesn't hold references to the destroyed child.
    dep._onDestroyHandlers.push(() => {
      removeUnordered(this._depListenersHandlers, unsub)
    })
  }

  createView(viewFn: (s: any) => any): ViewExt {
    let view!: ViewExt
    this.effectScope.run(() => {
      view = reactiveView(() => {
        const oldCtx = this.accessContext
        this.accessContext = AccessContext.VIEW
        try {
          let value = viewFn.call(this.proxy, this.proxy)
          if (__DEV__) {
            if (isObject(value)) {
              if (value === this.proxy) {
                warn(
                  `detected that "self" is returned in view, it would cause unpected behavior`
                )
                value = this.getApi()
              } else if (value === this.proxy.$state) {
                warn(
                  `detected that "$state" is returned in view, it would cause unpected behavior`
                )
                value = this._currentState
              }
            }
          }
          return value
        } finally {
          this.accessContext = oldCtx
        }
      }) as ViewExt
    })

    view.getSnapshot = () => {
      const value = view.value
      if (view.mightChange) {
        view.mightChange = false
        view.__snapshot = snapshot(value, this.stateRef.value)
      } else if (view.__pre !== value) {
        view.__snapshot = snapshot(value, this.stateRef.value)
      }
      view.__pre = value
      return view.__snapshot
    }
    this.viewInstances.push(view)

    return view!
  }

  reducer(state: ModelState<AnyModel>, action: Action) {
    switch (action.type) {
      case ActionType.MODIFY:
      case ActionType.PATCH: {
        return snapshot(
          this.stateRef.value,
          this.stateRef.value,
          this._lastDraftToSnapshot
        )
      }
      case ActionType.REPLACE:
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
    this._lastDraftToSnapshot = new WeakMap()

    this._currentState = null
    this.stateRef = {
      value: null,
    }
    this._subscribers.length = 0
    this.effectScope.stop()

    // clear subscriptions
    for (const unsub of this._depListenersHandlers) {
      unsub()
    }
    this._draftListenerHandler()

    // clear query caches
    this.queryCache.clear()
    this.queryNotifiers.clear()
    this._pendingQueryNotifierHashes.clear()
    this._queryIndex.clear()

    // notify dependents so they can clean up references to this model
    for (const handler of this._onDestroyHandlers) {
      handler()
    }
    this._onDestroyHandlers.length = 0
  }

  get destroyed(): boolean {
    return this._destroyed
  }

  get queryHashScope(): string {
    return this._queryHashScope
  }

  private _setState(newState: ModelState<IModel>) {
    this._api = null
    this._currentState = newState
    this.stateValue = this.stateRef.value
  }

  private _update() {
    if (this._destroyed || !isModified(this.stateRef as any)) {
      return
    }

    this.dispatch({
      type: ActionType.MODIFY,
    })
    markUnchanged(this.stateRef as any)
  }

  private _triggerListener(event: ModelChangeEvent) {
    // Snapshot to prevent mid-iteration subscribe/unsubscribe from
    // adding phantom notifications or skipping existing subscribers.
    const listeners = this._subscribers.slice()
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](event)
    }
  }

  private _runAction(
    action: () => any,
    options: {
      name?: string
      beforeAction?: () => void
    } = {}
  ) {
    const { name, beforeAction } = options

    if (name && this.accessContext === AccessContext.VIEW) {
      if (__DEV__) {
        warn(
          `Action "${String(
            name
          )}" is called in view function, it will be ignored and has no effect.`
        )
      }
      return
    }

    this._actionDepth++
    let res: any
    try {
      beforeAction?.()
      res = action()
    } finally {
      // Flush changes to the model synchronously after the outermost action.
      // This prevents issues like https://github.com/pmndrs/valtio/issues/270.
      if (--this._actionDepth === 0) {
        invalidateJob(this._update)
        this._update()
      }
    }

    return res
  }

  private _initActions() {
    // map actions names to dispatch actions
    const actions = this.options.actions
    if (actions) {
      for (const actionName of Object.keys(actions)) {
        this._cacheAccess(actionName, AccessTypes.ACTION)
        this._actionKeys.push(actionName)
        const action = actions[actionName]

        Object.defineProperty(this.actions, actionName, {
          configurable: true,
          enumerable: true,
          writable: false,
          value: (...args: any[]) => {
            return this._runAction(() => action.apply(this.proxy, args), {
              name: actionName,
              beforeAction: () => {
                const actionListeners = this._actionListeners.slice()
                for (let i = 0; i < actionListeners.length; i++) {
                  actionListeners[i]({
                    name: actionName,
                    args,
                  })
                }
              },
            })
          },
        })
      }
    }
  }

  private _initModels() {
    for (const modelName of Object.keys(this.models)) {
      this._cacheAccess(modelName, AccessTypes.MODEL)
      this._modelKeys.push(modelName)
    }
    Object.freeze(this.models)
    Object.freeze(this.modelProxies)
  }

  private _initViews() {
    const views = this.options.views
    if (views) {
      for (const viewName of Object.keys(views)) {
        this._cacheAccess(viewName, AccessTypes.VIEW)
        const viewFn = views[viewName]
        const view = this.createView(viewFn)
        this._modelViews.push(view)
        Object.defineProperty(this.views, viewName, {
          configurable: true,
          enumerable: true,
          get: view.getSnapshot,
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

  private _initQueries() {
    const queries = (this.options as any).queries
    if (queries) {
      for (const queryName of Object.keys(queries)) {
        const spec = queries[queryName]
        if (!isQuerySpecLike(spec)) {
          continue
        }
        this._cacheAccess(queryName, AccessTypes.QUERY)
        this._queryKeys.push(queryName)
        const handle = this._buildQueryHandle(queryName, spec)
        ;(this.queries as any)[queryName] = handle
      }
    }
    Object.freeze(this.queries)
  }

  private _cacheAccess(key: string, type: AccessTypes) {
    if (this.accessCache[key] === undefined) {
      this.accessCache[key] = type
    }
  }

  private _buildQueryHandle(
    queryName: string,
    spec: NormalizedQuerySpec
  ): InternalQueryHandle {
    const self = this
    const shouldIgnoreQueryCallInView = (methodName: string) => {
      if (self.accessContext !== AccessContext.VIEW) {
        return false
      }
      if (__DEV__) {
        warn(
          `Query "${queryName}.${methodName}" is called in view function, it will be ignored and has no effect.`
        )
      }
      return true
    }
    // fn.length > 1 means fn(ctx, args) — i.e. the query requires args.
    const hasArgs = spec.fn.length > 1
    const handle: any = {
      _model: this.publicInst,
      _queryName: queryName,
      _spec: spec,
      _hasArgs: hasArgs,
    }

    handle.getData = (...args: any[]) => {
      if (shouldIgnoreQueryCallInView('getData')) {
        return undefined
      }
      return self.getQueryData(queryName, args)
    }
    handle.setData = hasArgs
      ? (...argsAndData: any[]) => {
          if (shouldIgnoreQueryCallInView('setData')) {
            return
          }
          const data = argsAndData[argsAndData.length - 1]
          const args = argsAndData.slice(0, -1)
          self.setQueryData(queryName, args, data)
        }
      : (data: any) => {
          if (shouldIgnoreQueryCallInView('setData')) {
            return
          }
          self.setQueryData(queryName, emptyArray, data)
        }
    handle.getState = (...args: any[]) => {
      if (shouldIgnoreQueryCallInView('getState')) {
        return undefined
      }
      return self.getQueryState(queryName, args)
    }
    handle.isFetching = (...args: any[]) => {
      if (shouldIgnoreQueryCallInView('isFetching')) {
        return false
      }
      return self.getQueryState(queryName, args)?.fetchStatus === 'fetching'
    }
    handle.isStale = (...args: any[]): boolean => {
      if (shouldIgnoreQueryCallInView('isStale')) {
        return true
      }
      if (!self.coordinator) return true
      return self.coordinator.isStale(self, queryName, args)
    }
    handle.fetch = (...args: any[]): Promise<any> => {
      if (shouldIgnoreQueryCallInView('fetch')) {
        return Promise.resolve(undefined)
      }
      if (!self.coordinator) return Promise.resolve(undefined)
      return self.coordinator.fetch(self, queryName, args) as Promise<any>
    }
    handle.prefetch = (...args: any[]): Promise<void> => {
      if (shouldIgnoreQueryCallInView('prefetch')) {
        return Promise.resolve()
      }
      return self.prefetchQuery(queryName, args)
    }
    handle.cancel = (...args: any[]) => {
      if (shouldIgnoreQueryCallInView('cancel')) {
        return
      }
      self.cancelQueries(queryName, args)
    }
    handle.invalidate = (...args: any[]) => {
      if (shouldIgnoreQueryCallInView('invalidate')) {
        return
      }
      self.invalidateQueries(queryName, args)
    }
    handle.reset = (...args: any[]) => {
      if (shouldIgnoreQueryCallInView('reset')) {
        return
      }
      self.resetQueries(queryName, args)
    }

    // Hook integration
    handle.computeHash = (...args: any[]): QueryHash =>
      self._queryHash(queryName, args)
    handle.subscribe = (args: readonly unknown[], listener: () => void) => {
      if (shouldIgnoreQueryCallInView('subscribe')) {
        return NOOP
      }
      return self.subscribeQuery(queryName, args, listener)
    }
    handle.observe = (...args: any[]) => {
      if (shouldIgnoreQueryCallInView('observe')) {
        return
      }
      if (self.coordinator) {
        self.coordinator.observeQuery(self._queryHash(queryName, args))
      }
    }
    handle.unobserve = (args: readonly unknown[], cleanup: () => void) => {
      if (shouldIgnoreQueryCallInView('unobserve')) {
        return
      }
      if (self.coordinator) {
        self.coordinator.unobserveQuery(
          self._queryHash(queryName, args),
          cleanup
        )
      }
    }

    return handle as InternalQueryHandle
  }

  private _queryHash(queryName: string, args?: readonly unknown[]): QueryHash {
    return computeQueryHash(
      this._queryHashScope,
      queryName,
      computeArgsKey(args)
    )
  }

  subscribeQuery(
    queryName: string,
    args: readonly unknown[],
    listener: () => void
  ): () => void {
    const hash = this._queryHash(queryName, args)
    let listeners = this.queryNotifiers.get(hash)
    if (!listeners) {
      listeners = []
      this.queryNotifiers.set(hash, listeners)
    }
    listeners.push(listener)
    return () => {
      removeUnordered(listeners!, listener)
      if (listeners!.length === 0) {
        this.queryNotifiers.delete(hash)
      }
    }
  }

  getQueryState(
    queryName: string,
    args: readonly unknown[]
  ): QueryCacheEntry | undefined {
    return this.queryCache.get(this._queryHash(queryName, args))
  }

  setQueryState(
    queryName: string,
    args: readonly unknown[],
    entry: QueryCacheEntry
  ): void {
    const hash = this._queryHash(queryName, args)
    this.queryCache.set(hash, entry)
    this._queryIndex.set(hash, {
      scope: this._queryHashScope,
      queryName,
      data: null,
    })

    this._notifyQueryListeners(hash)
  }

  private _notifyQueryListeners(hash: QueryHash) {
    this._pendingQueryNotifierHashes.add(hash)
    queuePostJob(this._flushQueryListeners)
  }

  private _flushQueryListeners() {
    if (this._destroyed) {
      this._pendingQueryNotifierHashes.clear()
      return
    }

    const hashes = Array.from(this._pendingQueryNotifierHashes)
    this._pendingQueryNotifierHashes.clear()

    for (let i = 0; i < hashes.length; i++) {
      const listeners = this.queryNotifiers.get(hashes[i])
      if (listeners) {
        const snapshot = listeners.slice()
        for (let j = 0; j < snapshot.length; j++) {
          snapshot[j]()
        }
      }
    }
  }

  invalidateQueries(queryName?: string, args?: readonly unknown[]): void {
    if (queryName && args !== undefined && args.length > 0) {
      const hash = this._queryHash(queryName, args)
      const entry = this.queryCache.get(hash)
      if (entry) {
        this.queryCache.set(hash, { ...entry, dataUpdatedAt: 0 })
        this._notifyQueryListeners(hash)
      }
      return
    }

    this._queryIndex.forEach(this._prefixKey(queryName), (hash) => {
      const entry = this.queryCache.get(hash)
      if (entry) {
        this.queryCache.set(hash, { ...entry, dataUpdatedAt: 0 })
        this._notifyQueryListeners(hash)
      }
    })
  }

  setQueryData(
    queryName: string,
    args: readonly unknown[],
    data: unknown,
    fetchStatus?: FetchStatus
  ): void {
    const handle = this.queries[queryName]
    const onData = handle?._spec.onData

    // Always update the query cache entry
    const writeQueryCache = () => {
      const hash = this._queryHash(queryName, args)
      const existing = this.queryCache.get(hash)
      const entry: QueryCacheEntry = {
        data,
        error: undefined,
        dataUpdatedAt: Date.now(),
        fetchStatus: fetchStatus ?? existing?.fetchStatus ?? 'idle',
      }
      this.setQueryState(queryName, args, entry)
    }

    if (onData) {
      const applyOnData = onData as Function
      this._runAction(() => {
        applyOnData({
          api: this.proxy,
          args,
          data,
        })
        writeQueryCache()
      })
      return
    }

    writeQueryCache()
  }

  getQueryData(queryName: string, args?: readonly unknown[]): unknown {
    return this.queryCache.get(this._queryHash(queryName, args))?.data
  }

  prefetchQuery(
    queryName: string,
    args: readonly unknown[] = emptyArray
  ): Promise<void> {
    if (this.coordinator) {
      const prefetchPromise = this.coordinator
        .fetch(this, queryName, args)
        .then(() => undefined)
      prefetchPromise.catch(NOOP)
      return prefetchPromise
    }
    return Promise.resolve()
  }

  cancelQueries(queryName?: string, args?: readonly unknown[]): void {
    if (this.coordinator) {
      this.coordinator.cancel(this, queryName, args)
    }
  }

  resetQueries(queryName?: string, args?: readonly unknown[]): void {
    if (queryName && args !== undefined && args.length > 0) {
      const hash = this._queryHash(queryName, args)
      this.queryCache.delete(hash)
      this._notifyQueryListeners(hash)
      this._queryIndex.deleteHash(hash)
      return
    }

    const hashes = this._queryIndex.delete(this._prefixKey(queryName))
    for (const hash of hashes) {
      this.queryCache.delete(hash)
      this._notifyQueryListeners(hash)
    }
  }

  private _prefixKey(queryName?: string): QueryHashPrefixKey {
    return queryName === undefined
      ? [this._queryHashScope]
      : [this._queryHashScope, queryName]
  }
}

export function createModelInstance<IModel extends AnyObjectModel>(
  modelOptions: IModel,
  options: ModelInternalOptions = {}
) {
  if (__DEV__) {
    validateModelOptions(modelOptions)
  }

  return new ModelInternal<IModel>(modelOptions, options)
}
