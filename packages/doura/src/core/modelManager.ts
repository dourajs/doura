import { State, AnyModel, ModelOptions } from './modelOptions'
import {
  createModelInstnace,
  ModelInternal,
  SubscriptionCallback,
  UnSubscribe,
} from './model'
import { ModelPublicInstance } from './modelPublicInstance'
import { queueJob, SchedulerJob } from './scheduler'
import { Plugin, PluginHook } from './plugins'
import { emptyObject } from '../utils'

export type ModelManagerOptions = {
  initialState?: Record<string, any>
  plugins?: [Plugin, any?][]
}

export interface ModelManager {
  getState(): Record<string, State>
  getModel<IModel extends ModelOptions<any, any, any, any, any>>(
    model: IModel
  ): ModelPublicInstance<IModel>
  subscribe(fn: DouraSubscriptionCallback): UnSubscribe
  subscribe(model: AnyModel, fn: SubscriptionCallback): UnSubscribe
  destroy(): void
}

export interface DouraSubscriptionCallback {
  (): any
}

interface MapHelper {
  get(key: AnyModel): ModelInternal | undefined
  set(key: AnyModel, model: ModelInternal): void
  each(fn: (item: ModelInternal) => void): void
  clear(): void
}

const createMapHelper = (): MapHelper => {
  const models = new Map<string, ModelInternal>()

  const self: MapHelper = {
    get(modelOptions: AnyModel) {
      return models.get(modelOptions.name || modelOptions)
    },
    set(modelOptions: AnyModel, model: ModelInternal) {
      models.set(modelOptions.name || modelOptions, model)
    },
    each(fn) {
      for (const model of models.values()) {
        fn(model)
      }
    },
    clear() {
      self.each((m) => m.destroy())
      models.clear()
    },
  }

  return self
}

class ModelManagerImpl implements ModelManager {
  private _initialState: Record<string, State>
  private _hooks: PluginHook[]
  private _models: MapHelper
  private _subscribers: Set<DouraSubscriptionCallback> = new Set()
  private _onModelChange: DouraSubscriptionCallback

  constructor(initialState = emptyObject, plugins: [Plugin, any?][] = []) {
    this._initialState = initialState
    this._models = createMapHelper()
    const emitChange: SchedulerJob = () => {
      for (const listener of this._subscribers) {
        listener()
      }
    }
    this._onModelChange = () => {
      queueJob(emitChange)
    }
    this._hooks = plugins.map(([plugin, option]) => plugin(option))
    this._hooks.map((hook) => hook.onInit?.({ initialState }, { doura: this }))
  }

  getModel<IModel extends AnyModel>(model: IModel) {
    let instance = this._getModelInstance(model)
    return instance.proxy as ModelPublicInstance<IModel>
  }

  getState() {
    const allState = {} as ReturnType<ModelManager['getState']>
    const anonymousState: any[] = []
    this._models.each((m) => {
      if (m.name) {
        allState[m.name] = m.getState()
      } else {
        anonymousState.push(m.getState())
      }
    })

    if (anonymousState.length) {
      allState['_'] = anonymousState
    }

    return allState
  }

  subscribe(fn: DouraSubscriptionCallback): UnSubscribe
  subscribe(model: AnyModel, fn: SubscriptionCallback): UnSubscribe
  subscribe(modelOrFn: any, fn?: any): any {
    if (typeof modelOrFn === 'function') {
      const listener: DouraSubscriptionCallback = modelOrFn
      this._subscribers.add(listener)
      return () => {
        this._subscribers.delete(listener)
      }
    } else if (typeof fn === 'function') {
      const model: AnyModel = modelOrFn
      const instance = this._getModelInstance(model)
      return instance.subscribe(fn)
    }
  }

  destroy() {
    this._hooks.map((hook) => hook.onDestroy?.())
    this._models.clear()
    this._subscribers.clear()
    this._initialState = emptyObject
  }

  private _getModelInstance(model: AnyModel) {
    let cacheStore = this._models.get(model)
    if (cacheStore) {
      return cacheStore
    }

    return this._initModel(model)
  }

  private _initModel(model: AnyModel): ModelInternal {
    this._hooks.map((hook) => hook.onModel?.(model, { doura: this }))

    const modelInstance = createModelInstnace(
      model,
      this._getInitialState(model.name)
    )
    modelInstance.subscribe(this._onModelChange)

    const depends = model.models
    if (depends) {
      for (const [name, dep] of Object.entries(depends)) {
        // todo: lazy init
        const depInstance = this._getModelInstance(dep)
        modelInstance.depend(name, depInstance)
      }
    }

    this._models.set(model, modelInstance)
    this._hooks.map((hook) => {
      hook.onModelInstance?.(modelInstance.proxy!, { doura: this })
    })

    return modelInstance
  }

  private _getInitialState(name: string): State | undefined {
    const result = this._initialState[name]
    if (result) {
      delete this._initialState[name]
    }
    return result
  }
}

export function modelManager({
  initialState,
  plugins,
}: ModelManagerOptions = {}): ModelManager {
  return new ModelManagerImpl(initialState, plugins)
}
