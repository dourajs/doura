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

  it('should reject duplicate inflight fetches for the same hash', async () => {
    const fn = jest.fn(() => Promise.resolve('data'))
    const p1 = fm.fetch(hash('a'), fn)
    expect(() => fm.fetch(hash('a'), fn)).toThrow(
      'Fetch already in flight for hash'
    )
    await expect(p1).resolves.toBe('data')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should not deduplicate different hashes', async () => {
    const fn = jest.fn(() => Promise.resolve('data'))
    const l1 = fm.fetch(hash('a'), fn)
    const l2 = fm.fetch(hash('b'), fn)
    await Promise.all([l1, l2])
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

  it('should cancel multiple inflight requests by exact hash list', async () => {
    const signals: AbortSignal[] = []
    const makePromise = (signal: AbortSignal) => {
      signals.push(signal)
      return new Promise((resolve) => setTimeout(() => resolve('data'), 1000))
    }
    fm.fetch(hash('a'), makePromise)
    fm.fetch(hash('b'), makePromise)
    fm.fetch(hash('c'), makePromise)

    fm.cancelMany([hash('a'), hash('b')])
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
