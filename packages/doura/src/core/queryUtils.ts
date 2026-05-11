import type { QueryHash } from './queryTypes'

export function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v)).join(',') + ']'
  }
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const parts: string[] = []
  for (const key of keys) {
    const v = (value as Record<string, unknown>)[key]
    if (v === undefined) continue
    parts.push(JSON.stringify(key) + ':' + stableStringify(v))
  }
  return '{' + parts.join(',') + '}'
}

export function computeArgsKey(args?: readonly unknown[]): unknown[] {
  return args ? [...args] : []
}

export function computeQueryHash(
  modelName: string,
  queryName: string,
  key: unknown[]
): QueryHash {
  return stableStringify([modelName, queryName, ...key]) as QueryHash
}
