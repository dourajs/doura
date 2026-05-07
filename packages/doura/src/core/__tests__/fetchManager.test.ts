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
    expect(result).toBe('data')
  })

  it('should deduplicate concurrent fetches for same hash', async () => {
    const fn = jest.fn(() => Promise.resolve('data'))
    const p1 = fm.fetch(hash('a'), fn)
    const p2 = fm.fetch(hash('a'), fn)
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('data')
    expect(r2).toBe('data')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should not deduplicate different hashes', async () => {
    const fn = jest.fn(() => Promise.resolve('data'))
    const p1 = fm.fetch(hash('a'), fn)
    const p2 = fm.fetch(hash('b'), fn)
    await Promise.all([p1, p2])
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should allow re-fetch after previous resolve', async () => {
    const fn = jest.fn(() => Promise.resolve('data'))
    await fm.fetch(hash('a'), fn)
    await fm.fetch(hash('a'), fn)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should pass AbortSignal to fetcher', async () => {
    let receivedSignal: AbortSignal | null = null
    await fm.fetch(hash('a'), (signal) => {
      receivedSignal = signal
      return Promise.resolve('data')
    })
    expect(receivedSignal).toBeInstanceOf(AbortSignal)
  })

  it('should cancel inflight request', async () => {
    let receivedSignal: AbortSignal | null = null
    const promise = fm.fetch(hash('a'), (signal) => {
      receivedSignal = signal
      return new Promise((resolve) => setTimeout(() => resolve('data'), 1000))
    })
    fm.cancel(hash('a'))
    expect(receivedSignal!.aborted).toBe(true)
    await expect(promise).rejects.toThrow()
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
})
