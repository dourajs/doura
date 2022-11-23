import {
  State,
  AnyModel,
  AnyFunctionModel,
  ModelOptionContext,
  AnyObjectModel,
} from './modelOptions'
import { createModelInstnace, ModelInternal, UnSubscribe } from './model'
import { ModelPublicInstance } from './modelPublicInstance'
import { queueJob, SchedulerJob } from './scheduler'
import { Plugin, PluginHook } from './plugins'
import { emptyObject } from '../utils'

interface UseContext {
  add(model: ModelInternal): any
  setInitiator(model: ModelInternal): void
}

export type ModelManagerOptions = {
  initialState?: Record<string, any>
  plugins?: [Plugin, any?][]
}

export type Model = AnyModel | AnyFunctionModel

export interface ModelManager {
  getState(): Record<string, State>
  getModel<IModel extends AnyModel>(
    name: string,
    model: IModel
  ): ModelPublicInstance<IModel>
  getDetachedModel<IModel extends AnyModel>(
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
  each(fn: (item: ModelInternal, key: string) => void): void
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
      for (const [key, model] of models.entries()) {
        fn(model, key)
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

  getModel<IModel extends AnyModel>(
    name: string,
    model: IModel
  ): ModelPublicInstance<IModel> {
    const instance = this._getNamedModel(name, model)

    return instance.proxy as ModelPublicInstance<IModel>
  }

  getDetachedModel<IModel extends AnyModel>(
    model: IModel
  ): ModelPublicInstance<IModel> {
    const instance = this._getDetachedModel(model)
    return instance.proxy as ModelPublicInstance<IModel>
  }

  getState() {
    const allState = {} as ReturnType<ModelManager['getState']>

    this._models.each((m, key) => {
      allState[key] = m.getState()
    })

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

  private _getNamedModel(name: string, model: AnyModel) {
    let cacheStore = this._models.get(name)
    if (cacheStore) {
      return cacheStore
    }

    if (typeof model === 'function') {
      const useContext = this._createUseContext()
      const modelContext: ModelOptionContext = {
        use: this._use.bind(this, useContext) as any,
      }
      model = model(modelContext)
      const instance = this._initModel(name, model)
      useContext.setInitiator(instance)
      return instance
    }

    return this._initModel(name, model)
  }

  private _createUseContext(): UseContext {
    let models: ModelInternal[] = []
    let initiator: ModelInternal | undefined

    let useHandler: UseContext = {
      add(m) {
        if (initiator) {
          initiator.depend(m)
        } else {
          models.push(m)
        }
      },
      setInitiator(m) {
        if (initiator) {
          return
        }

        initiator = m
        for (const m of models) {
          initiator.depend(m)
        }
        models.length = 0
      },
    }

    return useHandler
  }

  private _getDetachedModel(model: AnyModel) {
    let instance: ModelInternal
    if (typeof model === 'function') {
      const factory = model
      const useContext = this._createUseContext()
      const modelContext: ModelOptionContext = {
        use: this._use.bind(this, useContext) as any,
      }
      instance = createModelInstnace(factory(modelContext))
      useContext.setInitiator(instance)
    } else if (typeof model === 'object') {
      instance = createModelInstnace(model)
    } else {
      throw new Error('invalid model')
    }
    return instance
  }

  private _use(
    context: UseContext,
    model: AnyFunctionModel
  ): ModelPublicInstance<any>
  private _use(
    context: UseContext,
    name: string,
    model: AnyModel
  ): ModelPublicInstance<any>
  private _use(p1: UseContext, p2: any, p3?: any): any {
    let instance: ModelInternal

    const parentUseContext = p1
    if (typeof p2 === 'string') {
      const name = p2
      const model = p3
      instance = this._getNamedModel(name, model)
    } else {
      const model = p2
      instance = this._getDetachedModel(model)
    }

    if (parentUseContext) {
      parentUseContext.add(instance)
    }

    return instance.proxy
  }

  private _initModel(name: string, model: AnyObjectModel): ModelInternal {
    this._hooks.map((hook) => hook.onModel?.(name, model, { doura: this }))

    const modelInstance = createModelInstnace(model, {
      name,
      initState: this._getInitialState(name),
    })
    modelInstance.subscribe(this._onModelChange)

    this._models.set(name, modelInstance)
    this._hooks.map((hook) => {
      hook.onModelInstance?.(modelInstance.proxy, { doura: this })
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
