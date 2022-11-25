import { doura } from 'doura'
import { createMemoryStorage } from './utils/createMemoryStorage'
import douraPersist from '../src/index'
import getStoredState from '../src/getStoredState'
import { a } from './models/a'
import { b } from './models/b'
import { delay } from './utils/delay'

let memoryStorage = createMemoryStorage()

let config = {
  key: 'persist-reducer-test',
  storage: memoryStorage,
}

beforeEach(() => {
  memoryStorage = createMemoryStorage()
  config = {
    key: 'persist-reducer-test',
    storage: memoryStorage,
  }
})

describe('persist plugin worked:', () => {
  test('blacklist worked', async () => {
    const douraStore = doura({
      plugins: [
        [
          douraPersist,
          {
            ...config,
            blacklist: ['a'],
          },
        ],
      ],
    })
    await delay(100)
    const aStore = douraStore.getModel('a', a)
    aStore.add()
    const bStore = douraStore.getModel('b', b)
    bStore.add()
    await delay(100)
    let StorageState = await getStoredState(config)
    expect(StorageState).toStrictEqual({
      b: { b: 1 },
    })
  })

  test('whitelist worked', async () => {
    const douraStore = doura({
      plugins: [
        [
          douraPersist,
          {
            ...config,
            whitelist: ['a'],
          },
        ],
      ],
    })
    await delay(100)
    const aStore = douraStore.getModel('a', a)
    aStore.add()
    const bStore = douraStore.getModel('b', b)
    bStore.add()
    await delay(100)
    let StorageState = await getStoredState(config)
    expect(StorageState).toStrictEqual({
      a: { a: 1 },
    })
  })

  test('migrate worked', async () => {
    const douraStore = doura({
      plugins: [
        [
          douraPersist,
          {
            ...config,
            migrate: function (StorageState: any, version: number) {
              return { a: { a: 1 } }
            },
          },
        ],
      ],
    })
    const aStore = douraStore.getModel('a', a)
    await delay(100)
    expect(aStore.$state).toStrictEqual({ a: 1 })
  })

  test('version worked', async () => {
    const douraStore = doura({
      plugins: [
        [
          douraPersist,
          {
            ...config,
            version: 1,
          },
        ],
      ],
    })
    await delay(100)
    const aStore = douraStore.getModel('a', a)
    aStore.add()
    await delay(100)
    let StorageState = await getStoredState(config)
    expect(StorageState).toStrictEqual({
      a: { a: 1 },
    })
  })
})
