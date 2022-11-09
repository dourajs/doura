import { modelManager, ModelManager, ModelManagerOptions } from './core'
import devTools from './devtools'

export interface Doura extends ModelManager {}
export interface DouraOptions extends ModelManagerOptions {}

export function doura({
  initialState,
  plugins = [],
}: DouraOptions = {}): Doura {
  if (process.env.NODE_ENV === 'development') {
    plugins.unshift([devTools])
  }

  return modelManager({
    initialState,
    plugins,
  })
}
