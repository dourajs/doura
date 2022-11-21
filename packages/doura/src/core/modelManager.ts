import { State, AnyModel } from './modelOptions'
import { createModelInstnace, ModelInternal, UnSubscribe } from './model'
import { ModelPublicInstance } from './modelPublicInstance'
import { queueJob, SchedulerJob } from './scheduler'
import { Plugin, PluginHook } from './plugins'
import { emptyObject, invariant } from '../utils'

export type ModelManagerOptions = {
  initialState?: Record<string, any>
  plugins?: [Plugin, any?][]
}

export interface ModelManager {
  getState(): Record<string, State>
  getModel<IModel extends AnyModel>(model: IModel): ModelPublicInstance<IModel>
  getModel<IModel extends AnyModel>(
    name: string,
    model: IModel
  ): ModelPublicInstance<IModel>
  subscribe(fn: DouraSubscriptionCallback): UnSubscribe
  destroy(): void
}

export interface DouraSubscriptionCallback {
  (): any
}

interface MapHelper {
  get(key: string): ModelInternal | undefined
  set(key: string, model: ModelInternal): void
  each(fn: (item: ModelInternal) => void): void
  clear(): void
}

const createMapHelper = (): MapHelper => {
  const models = new Map<string, ModelInternal>()

  const self: MapHelper = {
    get(key: string) {
      return models.get(key)
    },
    set(key: string, model: ModelInternal) {
      models.set(key, model)
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

  getModel<IModel extends AnyModel>(model: IModel): ModelPublicInstance<IModel>
  getModel<IModel extends AnyModel>(
    name: string,
    model: IModel
  ): ModelPublicInstance<IModel>
  getModel(nameOrModel: any, model?: any): any {
    let name: string
    if (typeof nameOrModel === 'string') {
      name = nameOrModel
    } else {
      model = nameOrModel
      name = model.name
      invariant(typeof name !== 'undefined', 'name is required')
    }
    let instance = this._getModelInstance(name, model)
    return instance.proxy as ModelPublicInstance<AnyModel>
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

  subscribe(listener: DouraSubscriptionCallback): UnSubscribe {
    this._subscribers.add(listener)
    return () => {
      this._subscribers.delete(listener)
    }
  }

  destroy() {
    this._hooks.map((hook) => hook.onDestroy?.())
    this._models.clear()
    this._subscribers.clear()
    this._initialState = emptyObject
  }

  private _getModelInstance(name: string, model: AnyModel) {
    let cacheStore = this._models.get(name)
    if (cacheStore) {
      return cacheStore
    }

    return this._initModel(name, model)
  }

  private _initModel(name: string, model: AnyModel): ModelInternal {
    this._hooks.map((hook) => hook.onModel?.(name, model, { doura: this }))

    const modelInstance = createModelInstnace(
      model,
      this._getInitialState(name)
    )
    modelInstance.subscribe(this._onModelChange)

    const depends = model.models
    if (depends) {
      for (const [name, dep] of Object.entries(depends)) {
        const depInstance = this._getModelInstance(name, dep)
        modelInstance.depend(name, depInstance)
      }
    }

    this._models.set(name, modelInstance)
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
