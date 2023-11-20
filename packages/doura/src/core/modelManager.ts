import {
  State,
  AnyModel,
  AnyFunctionModel,
  AnyObjectModel,
} from './modelOptions'
import { createModelInstance, ModelInternal, UnSubscribe } from './model'
import { ModelPublicInstance } from './modelPublicInstance'
import { queueJob, SchedulerJob } from './scheduler'
import { Plugin, PluginHook } from './plugins'
import { emptyObject } from '../utils'

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

export interface ModelContext {
  manager: ModelManagerInternal
  model: ModelProxy
}

export interface ModelProxy {
  addChild(child: ModelInternal): any
  setModel(model: ModelInternal): void
}

export let currentModelContext: ModelContext | null = null

export function setCurrentModelContext(ctx: ModelContext | null) {
  currentModelContext = ctx
}

class ModelManagerInternal implements ModelManager {
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
    const instance = this.getModelInstance({ name, model })
    return instance.publicInst as ModelPublicInstance<IModel>
  }

  getDetachedModel<IModel extends AnyModel>(
    model: IModel
  ): ModelPublicInstance<IModel> {
    const instance = this.getModelInstance({ model })
    return instance.publicInst as ModelPublicInstance<IModel>
  }

  getModelInstance({ name, model }: { name?: string; model: AnyModel }) {
    const cachedInstace = name && this._models.get(name)
    if (cachedInstace) {
      return cachedInstace
    }

    let instance: ModelInternal
    if (typeof model === 'function') {
      const preCtx = currentModelContext
      const modelProxy = this._createModelProxy()
      try {
        setCurrentModelContext({
          manager: this,
          model: modelProxy,
        })
        instance = this._initModel({ name, model: model() })
      } finally {
        setCurrentModelContext(preCtx)
      }
      modelProxy.setModel(instance)
    } else if (typeof model === 'object') {
      instance = this._initModel({ name, model })
    } else {
      throw new Error('invalid model')
    }

    return instance
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

  private _createModelProxy(): ModelProxy {
    const children: ModelInternal[] = []
    const modelProxy: ModelProxy = {
      addChild(m) {
        children.push(m)
      },
      setModel(model) {
        for (const child of children) {
          model.depend(child)
        }
        children.length = 0
      },
    }

    return modelProxy
  }

  private _initModel({
    name,
    model,
  }: {
    name?: string
    model: AnyObjectModel
  }): ModelInternal {
    if (!name) {
      return createModelInstance(model)
    }

    this._hooks.map((hook) => hook.onModel?.(name, model, { doura: this }))

    const modelInstance = createModelInstance(model, {
      name,
      initState: this._getInitialState(name),
    })
    modelInstance.subscribe(this._onModelChange)

    this._models.set(name, modelInstance)
    this._hooks.map((hook) => {
      hook.onModelInstance?.(modelInstance.publicInst, { doura: this })
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
  return new ModelManagerInternal(initialState, plugins)
}
