import { GCManager } from '../gcManager'

describe('GCManager', () => {
  let gc: GCManager

  beforeEach(() => {
    jest.useFakeTimers()
    gc = new GCManager()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should GC when refcount drops to 0', () => {
    const cleanup = jest.fn()
    gc.observe('a')
    gc.unobserve('a', 5000, cleanup)

    jest.advanceTimersByTime(5000)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('should not GC if re-observed before timer fires', () => {
    const cleanup = jest.fn()
    gc.observe('a')
    gc.unobserve('a', 5000, cleanup)

    jest.advanceTimersByTime(3000)
    gc.observe('a') // re-observe cancels timer

    jest.advanceTimersByTime(5000)
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('should handle multiple observers', () => {
    const cleanup = jest.fn()
    gc.observe('a')
    gc.observe('a') // refcount = 2

    gc.unobserve('a', 5000, cleanup) // refcount = 1, no timer
    jest.advanceTimersByTime(10000)
    expect(cleanup).not.toHaveBeenCalled()

    gc.unobserve('a', 5000, cleanup) // refcount = 0, timer scheduled
    jest.advanceTimersByTime(5000)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('should handle Infinity gcTime (no GC)', () => {
    const cleanup = jest.fn()
    gc.observe('a')
    gc.unobserve('a', Infinity, cleanup)
    jest.advanceTimersByTime(999999)
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('should handle gcTime 0 (immediate GC)', () => {
    const cleanup = jest.fn()
    gc.observe('a')
    gc.unobserve('a', 0, cleanup)
    jest.advanceTimersByTime(0)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
