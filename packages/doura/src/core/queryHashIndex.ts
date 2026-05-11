import type { QueryHash } from './queryTypes'

export type QueryHashPrefixKey =
  | readonly [scope: string]
  | readonly [scope: string, queryName: string]

export interface QueryHashEntry<T> {
  scope: string
  queryName: string
  data: T
}

export class QueryHashIndex<T> {
  private _entries = new Map<QueryHash, QueryHashEntry<T>>()

  get size(): number {
    return this._entries.size
  }

  set(hash: QueryHash, entry: QueryHashEntry<T>): void {
    this._entries.set(hash, entry)
  }

  get(hash: QueryHash): QueryHashEntry<T> | undefined {
    return this._entries.get(hash)
  }

  has(hash: QueryHash): boolean {
    return this._entries.has(hash)
  }

  deleteHash(hash: QueryHash): boolean {
    return this._entries.delete(hash)
  }

  clear(): void {
    this._entries.clear()
  }

  find(prefixKey: QueryHashPrefixKey): QueryHash[] {
    const hashes: QueryHash[] = []
    this.forEach(prefixKey, (hash) => {
      hashes.push(hash)
    })
    return hashes
  }

  delete(prefixKey: QueryHashPrefixKey): QueryHash[] {
    const hashes: QueryHash[] = []
    for (const [hash, entry] of this._entries) {
      if (matchesPrefixKey(entry, prefixKey)) {
        hashes.push(hash)
        this._entries.delete(hash)
      }
    }
    return hashes
  }

  forEach(
    prefixKey: QueryHashPrefixKey,
    cb: (hash: QueryHash, entry: QueryHashEntry<T>) => void
  ): void {
    for (const [hash, entry] of this._entries) {
      if (matchesPrefixKey(entry, prefixKey)) {
        cb(hash, entry)
      }
    }
  }
}

function matchesPrefixKey<T>(
  entry: QueryHashEntry<T>,
  prefixKey: QueryHashPrefixKey
): boolean {
  if (entry.scope !== prefixKey[0]) {
    return false
  }
  if (prefixKey.length === 1) {
    return true
  }
  return entry.queryName === prefixKey[1]
}
