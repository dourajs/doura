import { Plugin, ModelPublicInstance } from 'doura'
import createPersist from './createPersist'
import getStoredState from './getStoredState'
import { createWebStorage } from './storage'
import { persistModel } from './persistModel'
import { IStorageState, PersistOptions } from './types'

type StoreProxy = Parameters<
  ReturnType<typeof douraPersist>['onModelInstance'] & Function
> extends infer P
  ? P extends { 0: any }
    ? P[0]
    : undefined
  : undefined

function rehydrated(storageState: IStorageState, store: StoreProxy) {
  if (storageState && store.$name && storageState[store.$name]) {
    store.$patch(storageState[store.$name])
  }
}

const douraPersist: Plugin = function (options: PersistOptions) {
  const persist = createPersist(options)
  let persistStore: ModelPublicInstance<typeof persistModel>
  const unSubscribes = new Set<() => void>()
  const collectLoadingStore = new Set<StoreProxy>()
  let _storageState: IStorageState
  let _isPause = false
  let _isInit = false
  return {
    onInit(_options, { doura }) {
      persistStore = doura.getDetachedModel(persistModel)
      Object.assign(persistStore, {
        purge() {
          return persist.purge()
        },
        flush() {
          return persist.flush()
        },
        togglePause() {
          _isPause = !_isPause
          if (!_isPause && _isInit) {
            persist.update(doura.getState())
          }
        },
      })
      if (typeof options.version !== 'undefined') {
        persistStore.$patch({
          version: options.version,
        })
      }
      getStoredState(options)
        .then((state) => {
          return Promise.resolve(
            options.migrate?.(state, persistStore.$state.version) || state
          )
            .then((migrateState) => {
              _storageState = migrateState
              // fixme: collectLoadingStore may not ready
              for (const model of collectLoadingStore) {
                rehydrated(_storageState, model)
              }
              persistStore.$patch({
                rehydrated: true,
              })
              collectLoadingStore.clear()
              _isInit = true
            })
            .catch((err) => {
              console.error(`douraPersist options.migrate error:`, err)
            })
        })
        .catch((err) => {
          console.error(`getStoredState inner error:`, err)
        })
    },
    onModelInstance(instance, { doura }) {
      if (_isInit) {
        rehydrated(_storageState, instance)
      } else {
        collectLoadingStore.add(instance)
      }
      const unSubscribe = instance.$subscribe(function () {
        if (!_isPause && _isInit) {
          persist.update(doura.getState())
        }
      })
      unSubscribes.add(unSubscribe)
    },
    onDestroy() {
      for (const unSubscribe of unSubscribes) {
        unSubscribe()
      }
    },
  }
}

export { createWebStorage, persistModel }

export * from './types'

export default douraPersist
