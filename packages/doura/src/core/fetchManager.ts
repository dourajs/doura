import { NOOP } from '../utils'
import { QueryHash } from './queryTypes'

interface InflightEntry {
  controller: AbortController
  promise: Promise<unknown>
  reject: (reason: unknown) => void
}

export class FetchManager {
  private _inflight = new Map<QueryHash, InflightEntry>()

  private _abortEntry(hash: QueryHash, entry: InflightEntry): void {
    entry.controller.abort()
    entry.reject(new DOMException('The operation was aborted.', 'AbortError'))
    // Suppress unhandled rejection on the internal promise
    entry.promise.catch(NOOP)
    this._inflight.delete(hash)
  }

  fetch(
    hash: QueryHash,
    fetcher: (signal: AbortSignal) => Promise<unknown>
  ): Promise<unknown> {
    if (this._inflight.has(hash)) {
      throw new Error(`Fetch already in flight for hash ${String(hash)}`)
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
      this._abortEntry(hash, entry)
    }
  }

  cancelMany(hashes: Iterable<QueryHash>): void {
    for (const hash of hashes) {
      const entry = this._inflight.get(hash)
      if (entry) {
        this._abortEntry(hash, entry)
      }
    }
  }

  destroy(): void {
    for (const [hash, entry] of this._inflight) {
      this._abortEntry(hash, entry)
    }
  }
}
