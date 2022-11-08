import { doura } from 'doura'
import { createMemoryStorage } from './utils/createMemoryStorage'
import douraPersist from '../src/index'
import getStoredState from '../src/getStoredState'
import { a } from './models/a'
import { delay } from './utils/delay'

let memoryStorage = createMemoryStorage()

let config = {
  key: 'persist-reducer-test',
  storage: memoryStorage,
}

describe('getStoredState worked:', () => {
  test('get persist state and model state', async () => {
    const douraStore = doura({ plugins: [[douraPersist, config]] })
    const aStore = douraStore.getModel(a)
    aStore.add()
    await aStore.addAsync()
    await delay(100)
    const StorageState = await getStoredState(config)
    expect(StorageState).toStrictEqual({
      _persist: { rehydrated: true, version: -1 },
      a: { a: 2 },
    })
  })
})
