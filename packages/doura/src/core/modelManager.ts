import { State, AnyModel, AnyObjectModel } from './modelOptions'
import { createModelInstance, ModelInternal, UnSubscribe } from './model'
import { ModelInstance } from './modelPublicInstance'
import { queueJob, SchedulerJob } from './scheduler'
import { Plugin, PluginHook } from './plugins'
import { emptyObject, invariant, isArray, removeUnordered } from '../utils'
import { warn } from '../warning'
import { QueryConfig } from './queryTypes'
import { QueryCoordinator } from './queryCoordinator'

export type ModelManagerOptions = {
  initialState?: Record<string, any>
  plugins?: [Plugin, any?][]
  query?: Partial<QueryConfig>
}

export type Model = AnyModel

export interface ModelManager {
  getState(): Record<string, State>
  getModel<IModel extends AnyModel>(model: IModel): ModelInstance<IModel>
  getDetachedModel<IModel extends AnyModel>(
    model: IModel
  ): ModelInstance<IModel>
  subscribe(fn: DouraSubscriptionCallback): UnSubscribe
  destroy(): void
}

export interface DouraSubscriptionCallback {
  (): any
}

class ModelManagerInternal implements ModelManager {
  private _initialState: Record<string, State>
  private _hooks: PluginHook[]
  private _models = new Map<string, ModelInternal>()
  private _modelOptions = new Map<string, AnyModel>()
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

  getModel<IModel extends AnyModel>(model: IModel): ModelInstance<IModel>
  getModel(model: any): ModelInstance<any> {
    const instance = this.getModelInstance({ model })
    return instance.publicInst
  }

  getDetachedModel<IModel extends AnyModel>(
    model: IModel
  ): ModelInstance<IModel> {
    const instance = this.getModelInstance({ model, detached: true })
    return instance.publicInst as ModelInstance<IModel>
  }

  getModelInstance({
    model,
    detached = false,
  }: {
    model: AnyModel
    detached?: boolean
  }) {
    if (typeof model === 'object' && !detached) {
      const name = getModelName(model)
      const cachedInstance = this._models.get(name)
      if (cachedInstance) {
        if (this._modelOptions.get(name) !== model) {
          warn(
            `model "${name}" has already been initialized with a different model options reference`
          )
        }
        return cachedInstance
      }
    }

    let instance: ModelInternal
    if (typeof model === 'object') {
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
    this._subscribers.length = 0
    this._initialState = emptyObject
    this._queryCoordinator.destroy()
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
    const childInstances = this._initChildModels(model)
    const childModels = Object.create(null)
    const childModelProxies = Object.create(null)
    for (const child of childInstances) {
      childModels[child.name] = child.publicInst
      childModelProxies[child.name] = child.proxy
    }

    if (!name) {
      const instance = createModelInstance(model, {
        models: childModels,
        modelProxies: childModelProxies,
      })
      instance.coordinator = this._queryCoordinator
      for (const child of childInstances) {
        instance.depend(child)
      }
      return instance
    }

    this._hooks.map((hook) => hook.onModel?.(name, model, { doura: this }))

    const modelInstance = createModelInstance(model, {
      name,
      initState: this._getInitialState(name),
      models: childModels,
      modelProxies: childModelProxies,
    })
    modelInstance.coordinator = this._queryCoordinator
    for (const child of childInstances) {
      modelInstance.depend(child)
    }
    modelInstance.subscribe(this._onModelChange)

    this._models.set(name, modelInstance)
    this._modelOptions.set(name, sourceModel || model)
    this._hooks.map((hook) => {
      hook.onModelInstance?.(modelInstance.publicInst, { doura: this })
    })

    return modelInstance
  }

  private _initChildModels(model: AnyObjectModel): ModelInternal[] {
    const models = (model as any).models
    if (!models) {
      return []
    }
    invariant(isArray(models), `model.models should be array!`)

    return models.map((child: AnyObjectModel) =>
      this.getModelInstance({ model: child })
    )
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
