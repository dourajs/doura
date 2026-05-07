import { QueryHash } from './queryTypes'

interface InflightEntry {
  controller: AbortController
  promise: Promise<unknown>
  reject: (reason: unknown) => void
}

// noop to prevent unhandled rejection warnings
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {}

export class FetchManager {
  private _inflight = new Map<QueryHash, InflightEntry>()

  fetch(
    hash: QueryHash,
    fetcher: (signal: AbortSignal) => Promise<unknown>
  ): Promise<unknown> {
    const existing = this._inflight.get(hash)
    if (existing) {
      return existing.promise
    }

    const controller = new AbortController()
    let rejectFn: (reason: unknown) => void

    const promise = new Promise<unknown>((resolve, reject) => {
      rejectFn = reject
      fetcher(controller.signal).then(resolve, reject)
    })
      .then((result) => {
        this._inflight.delete(hash)
        return result
      })
      .catch((error) => {
        this._inflight.delete(hash)
        throw error
      })

    this._inflight.set(hash, { controller, promise, reject: rejectFn! })
    return promise
  }

  cancel(hash: QueryHash): void {
    const entry = this._inflight.get(hash)
    if (entry) {
      entry.controller.abort()
      entry.reject(new DOMException('The operation was aborted.', 'AbortError'))
      // Suppress unhandled rejection on the internal promise
      entry.promise.catch(noop)
      this._inflight.delete(hash)
    }
  }

  cancelByPrefix(prefix: string): void {
    for (const [hash, entry] of this._inflight) {
      if ((hash as string).startsWith(prefix)) {
        entry.controller.abort()
        entry.reject(
          new DOMException('The operation was aborted.', 'AbortError')
        )
        // Suppress unhandled rejection on the internal promise
        entry.promise.catch(noop)
        this._inflight.delete(hash)
      }
    }
  }
}
