export class GCManager {
  private _refcounts = new Map<string, number>()
  private _timers = new Map<string, ReturnType<typeof setTimeout>>()

  observe(key: string): void {
    const count = this._refcounts.get(key) || 0
    this._refcounts.set(key, count + 1)

    // Cancel any pending GC timer
    const timer = this._timers.get(key)
    if (timer !== undefined) {
      clearTimeout(timer)
      this._timers.delete(key)
    }
  }

  unobserve(key: string, gcTime: number, cleanup: () => void): void {
    const count = (this._refcounts.get(key) || 1) - 1
    this._refcounts.set(key, count)

    if (count > 0) return
    if (gcTime === Infinity) {
      this._refcounts.delete(key)
      return
    }

    const timer = setTimeout(() => {
      this._timers.delete(key)
      this._refcounts.delete(key)
      cleanup()
    }, gcTime)
    this._timers.set(key, timer)
  }

  destroy(): void {
    for (const timer of this._timers.values()) {
      clearTimeout(timer)
    }
    this._timers.clear()
    this._refcounts.clear()
  }
}
