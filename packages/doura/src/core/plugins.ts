import { State, AnyObjectModel } from './modelOptions'
import { ModelPublicInstance } from './modelPublicInstance'
import { ModelManager } from './modelManager'

export interface PluginContext {
  doura: ModelManager
}

export type PluginHook = {
  onInit?(
    options: { initialState: Record<string, State> },
    context: PluginContext
  ): void
  onModel?(name: string, model: AnyObjectModel, context: PluginContext): void
  onModelInstance?(
    instance: ModelPublicInstance<AnyObjectModel>,
    context: PluginContext
  ): void
  onDestroy?(): void
}

export type Plugin<Option = any> = (option: Option) => PluginHook
