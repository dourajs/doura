import {
  modelManager,
  type ModelManager,
  type ModelManagerOptions,
} from './core/index'

export interface Doura extends ModelManager {}
export interface DouraOptions extends ModelManagerOptions {}

export function doura({
  initialState,
  plugins = [],
  query,
}: DouraOptions = {}): Doura {
  return modelManager({
    initialState,
    plugins,
    query,
  })
}
