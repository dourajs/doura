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
import { emptyObject, invariant, removeUnordered } from '../utils'
import { warn } from '../warning'
import { QueryConfig } from './queryTypes'
import { QueryCoordinator } from './queryCoordinator'

export type ModelManagerOptions = {
  initialState?: Record<string, any>
  plugins?: [Plugin, any?][]
  query?: Partial<QueryConfig>
}

export type Model = AnyModel | AnyFunctionModel

export interface ModelManager {
  getState(): Record<string, State>
  getModel<IModel extends AnyModel>(model: IModel): ModelPublicInstance<IModel>
  getDetachedModel<IModel extends AnyModel>(
    model: IModel
  ): ModelPublicInstance<IModel>
  subscribe(fn: DouraSubscriptionCallback): UnSubscribe
  destroy(): void
}

export interface DouraSubscriptionCallback {
  (): any
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
  private _models = new Map<string, ModelInternal>()
  private _modelOptions = new Map<string, AnyModel>()
  private _sourceModelNames = new Map<AnyModel, string>()
  private _subscribers: DouraSubscriptionCallback[] = []
  private _onModelChange: DouraSubscriptionCallback
  _queryCoordinator: QueryCoordinator

  constructor(
    initialState = emptyObject,
    plugins: [Plugin, any?][] = [],
    query?: Partial<QueryConfig>
  ) {
    this._initialState = initialState
    this._queryCoordinator = new QueryCoordinator(query)
    const emitChange: SchedulerJob = () => {
      const listeners = this._subscribers.slice()
      for (let i = 0; i < listeners.length; i++) {
        listeners[i]()
      }
    }
    this._onModelChange = () => {
      queueJob(emitChange)
    }
    this._hooks = plugins.map(([plugin, option]) => plugin(option))
    this._hooks.map((hook) => hook.onInit?.({ initialState }, { doura: this }))
  }

  getModel<IModel extends AnyModel>(model: IModel): ModelPublicInstance<IModel>
  getModel(model: any): ModelPublicInstance<any> {
    const instance = this.getModelInstance({ model })
    return instance.publicInst
  }

  getDetachedModel<IModel extends AnyModel>(
    model: IModel
  ): ModelPublicInstance<IModel> {
    const instance = this.getModelInstance({ model, detached: true })
    return instance.publicInst as ModelPublicInstance<IModel>
  }

  getModelInstance({
    model,
    detached = false,
  }: {
    model: AnyModel
    detached?: boolean
  }) {
    if (typeof model === 'function' && !detached) {
      const cachedName = this._sourceModelNames.get(model)
      if (cachedName) {
        const cachedInstace = this._models.get(cachedName)
        if (cachedInstace) {
          return cachedInstace
        }
      }
    }

    if (typeof model === 'object' && !detached) {
      const name = getModelName(model)
      const cachedInstace = this._models.get(name)
      if (cachedInstace) {
        if (this._modelOptions.get(name) !== model) {
          warn(
            `model "${name}" has already been initialized with a different model options reference`
          )
        }
        return cachedInstace
      }
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
        const modelOptions = model()
        const name = getModelName(modelOptions)

        if (!detached) {
          const cachedInstace = this._models.get(name)
          if (cachedInstace) {
            if (this._modelOptions.get(name) !== model) {
              warn(
                `model "${name}" has already been initialized with a different model options reference`
              )
            }
            this._sourceModelNames.set(model, name)
            return cachedInstace
          }
        }

        instance = this._initModel({
          name: detached ? undefined : name,
          model: modelOptions,
          sourceModel: model,
        })
        if (!detached) {
          this._sourceModelNames.set(model, name)
        }
      } finally {
        setCurrentModelContext(preCtx)
      }
      modelProxy.setModel(instance)
    } else if (typeof model === 'object') {
      const name = getModelName(model)
      instance = this._initModel({
        name: detached ? undefined : name,
        model,
        sourceModel: model,
      })
    } else {
      throw new Error('invalid model')
    }

    return instance
  }

  getState() {
    const allState = {} as ReturnType<ModelManager['getState']>

    this._models.forEach((m, key) => {
      allState[key] = m.getState()
    })

    return allState
  }

  subscribe(listener: DouraSubscriptionCallback): UnSubscribe {
    this._subscribers.push(listener)
    return () => {
      removeUnordered(this._subscribers, listener)
    }
  }

  destroy() {
    this._hooks.map((hook) => hook.onDestroy?.())
    this._models.forEach((m) => m.destroy())
    this._models.clear()
    this._modelOptions.clear()
    this._sourceModelNames.clear()
    this._subscribers.length = 0
    this._initialState = emptyObject
    this._queryCoordinator.destroy()
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
    sourceModel,
  }: {
    name?: string
    model: AnyObjectModel
    sourceModel?: AnyModel
  }): ModelInternal {
    if (!name) {
      const instance = createModelInstance(model)
      instance.coordinator = this._queryCoordinator
      return instance
    }

    this._hooks.map((hook) => hook.onModel?.(name, model, { doura: this }))

    const modelInstance = createModelInstance(model, {
      name,
      initState: this._getInitialState(name),
    })
    modelInstance.coordinator = this._queryCoordinator
    modelInstance.subscribe(this._onModelChange)

    this._models.set(name, modelInstance)
    this._modelOptions.set(name, sourceModel || model)
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
  query,
}: ModelManagerOptions = {}): ModelManager {
  return new ModelManagerInternal(initialState, plugins, query)
}

function getModelName(model: AnyObjectModel): string {
  invariant(
    typeof model.name === 'string' && model.name.length > 0,
    'model name is required in model options'
  )
  return model.name
}
