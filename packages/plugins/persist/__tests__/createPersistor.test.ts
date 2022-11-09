import { createMemoryStorage } from './utils/createMemoryStorage'
import createPersist from '../src/createPersist'

let memoryStorage = createMemoryStorage()

let config = {
  key: 'persist-reducer-test',
  storage: memoryStorage,
}

let spy: any
jest.useFakeTimers()

beforeEach(() => {
  memoryStorage = createMemoryStorage()
  config = {
    key: 'persist-reducer-test',
    storage: memoryStorage,
  }
  spy = jest.spyOn(memoryStorage, 'setItem')
})

afterEach(() => {
  spy.mockRestore()
})

describe('createPersist worked:', () => {
  test('it updates changed state', () => {
    const { update } = createPersist(config)
    update({ a: 1 })
    jest.runOnlyPendingTimers()
    update({ a: 2 })
    jest.runOnlyPendingTimers()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenCalledWith('persist-reducer-test', '{"a":"1"}')
    expect(spy).toHaveBeenCalledWith('persist-reducer-test', '{"a":"2"}')
  })

  test('it does not update unchanged state', () => {
    const { update } = createPersist(config)
    update({ a: undefined, b: 1 })
    jest.runOnlyPendingTimers()
    // This update should not cause a write.
    update({ a: undefined, b: 1 })
    jest.runOnlyPendingTimers()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('persist-reducer-test', '{"b":"1"}')
  })

  test('it updates removed keys', () => {
    const { update } = createPersist(config)
    update({ a: undefined, b: 1 })
    jest.runOnlyPendingTimers()
    update({ a: undefined, b: undefined })
    jest.runOnlyPendingTimers()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenCalledWith('persist-reducer-test', '{"b":"1"}')
    expect(spy).toHaveBeenCalledWith('persist-reducer-test', '{}')
  })
})
