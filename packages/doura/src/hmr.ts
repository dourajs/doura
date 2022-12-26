import { AnyModel } from './core/modelOptions'
/**
 * Creates an _accept_ function to pass to `module.hot.dispose` in webpack applications.
 *
 * @example
 * ```js
 * const userModel = defineModel(...)
 * if (module.hot) {
 *   module.hot.accept()
 *   module.hot.dispose(acceptHMRUpdate(userModel))
 * }
 * ```
 *
 * @param initialUseModel - return of the defineModel to hot update
 */

export const CLEAR_CACHE = '__clearCache__' as const

export type HmrModel = AnyModel & {
  [CLEAR_CACHE]: Function[]
}

export function acceptHMRUpdate(initialUseModel: AnyModel) {
  // strip as much as possible from iife.prod
  if (!__DEV__) {
    return () => {}
  }
  return () => {
    const clearCacheFuns: Function[] | undefined = (
      initialUseModel as HmrModel
    )[CLEAR_CACHE]

    if (!clearCacheFuns) {
      // this store is still not used
      return
    }

    clearCacheFuns.forEach((fn) => fn())
  }
}
