import { State, AnyModel } from './modelOptions'
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
  onModel?(model: AnyModel, context: PluginContext): void
  onModelInstance?(
    instance: ModelPublicInstance<AnyModel>,
    context: PluginContext
  ): void
  onDestroy?(): void
}

export type Plugin<Option = any> = (option: Option) => PluginHook
