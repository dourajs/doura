import type { State, Model, ModelDefinition } from './modelOptions'
import type { ModelInstance } from './modelPublicInstance'
import type { ModelManager } from './modelManager'

export interface PluginContext {
  doura: ModelManager
}

export type PluginHook = {
  onInit?(
    options: { initialState: Record<string, State> },
    context: PluginContext
  ): void
  onModel?(name: string, model: Model, context: PluginContext): void
  onModelInstance?(
    instance: ModelInstance<ModelDefinition<Model>>,
    context: PluginContext
  ): void
  onDestroy?(): void
}

export type Plugin<Option = any> = (option: Option) => PluginHook
