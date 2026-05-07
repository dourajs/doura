import { FetchManager } from '../fetchManager'
import { QueryHash } from '../queryTypes'

const hash = (s: string) => s as QueryHash

describe('FetchManager', () => {
  let fm: FetchManager

  beforeEach(() => {
    fm = new FetchManager()
  })

  it('should execute a fetch and return result', async () => {
    const result = await fm.fetch(hash('a'), () => Promise.resolve('data'))
      .promise
    expect(result).toBe('data')
  })

  it('should deduplicate concurrent fetches for same hash', async () => {
    const fn = jest.fn(() => Promise.resolve('data'))
    const l1 = fm.fetch(hash('a'), fn)
    const l2 = fm.fetch(hash('a'), fn)
    expect(l1.isNew).toBe(true)
    expect(l2.isNew).toBe(false)
    const [r1, r2] = await Promise.all([l1.promise, l2.promise])
    expect(r1).toBe('data')
    expect(r2).toBe('data')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should not deduplicate different hashes', async () => {
    const fn = jest.fn(() => Promise.resolve('data'))
    const l1 = fm.fetch(hash('a'), fn)
    const l2 = fm.fetch(hash('b'), fn)
    await Promise.all([l1.promise, l2.promise])
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should allow re-fetch after previous resolve', async () => {
    const fn = jest.fn(() => Promise.resolve('data'))
    await fm.fetch(hash('a'), fn).promise
    await fm.fetch(hash('a'), fn).promise
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should pass AbortSignal to fetcher', async () => {
    let receivedSignal: AbortSignal | null = null
    await fm.fetch(hash('a'), (signal) => {
      receivedSignal = signal
      return Promise.resolve('data')
    }).promise
    expect(receivedSignal).toBeInstanceOf(AbortSignal)
  })

  it('should cancel inflight request', async () => {
    let receivedSignal: AbortSignal | null = null
    const lease = fm.fetch(hash('a'), (signal) => {
      receivedSignal = signal
      return new Promise((resolve) => setTimeout(() => resolve('data'), 1000))
    })
    fm.cancel(hash('a'))
    expect(receivedSignal!.aborted).toBe(true)
    await expect(lease.promise).rejects.toThrow()
  })

  it('should cancel by prefix', async () => {
    const signals: AbortSignal[] = []
    const makePromise = (signal: AbortSignal) => {
      signals.push(signal)
      return new Promise((resolve) => setTimeout(() => resolve('data'), 1000))
    }
    fm.fetch(hash('["users","fetch","1"]'), makePromise)
    fm.fetch(hash('["users","fetch","2"]'), makePromise)
    fm.fetch(hash('["posts","fetch","1"]'), makePromise)

    fm.cancelByPrefix('["users"')
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(true)
    expect(signals[2].aborted).toBe(false)
  })

  it('should destroy all inflight requests', async () => {
    const signals: AbortSignal[] = []
    const makePromise = (signal: AbortSignal) => {
      signals.push(signal)
      return new Promise((resolve) => setTimeout(() => resolve('data'), 1000))
    }
    fm.fetch(hash('a'), makePromise)
    fm.fetch(hash('b'), makePromise)

    fm.destroy()
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(true)
  })
})
