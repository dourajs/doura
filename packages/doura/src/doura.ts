import { modelManager, ModelManager, ModelManagerOptions } from './core/index'

export interface Doura extends ModelManager {}
export interface DouraOptions extends ModelManagerOptions {}

export function doura({
  initialState,
  plugins = [],
}: DouraOptions = {}): Doura {
  return modelManager({
    initialState,
    plugins,
  })
}
