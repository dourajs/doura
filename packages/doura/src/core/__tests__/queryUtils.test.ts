// packages/doura/src/core/__tests__/queryUtils.test.ts
import {
  stableStringify,
  computeArgsKey,
  computeQueryHash,
} from '../queryUtils'

describe('stableStringify', () => {
  it('should sort object keys deterministically', () => {
    const a = stableStringify({ b: 2, a: 1 })
    const b = stableStringify({ a: 1, b: 2 })
    expect(a).toBe(b)
    expect(a).toBe('{"a":1,"b":2}')
  })

  it('should handle nested objects', () => {
    const result = stableStringify({ b: { d: 4, c: 3 }, a: 1 })
    expect(result).toBe('{"a":1,"b":{"c":3,"d":4}}')
  })

  it('should handle arrays (preserve order)', () => {
    const result = stableStringify([3, 1, 2])
    expect(result).toBe('[3,1,2]')
  })

  it('should handle null and primitives', () => {
    expect(stableStringify(null)).toBe('null')
    expect(stableStringify(42)).toBe('42')
    expect(stableStringify('hello')).toBe('"hello"')
    expect(stableStringify(true)).toBe('true')
  })

  it('should handle undefined by omitting the key', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}')
  })
})

describe('computeArgsKey', () => {
  it('should return empty array for void args', () => {
    expect(computeArgsKey(undefined)).toEqual([])
  })

  it('should wrap stringified args in array when no keyFn', () => {
    const a = computeArgsKey({ id: '1' })
    const b = computeArgsKey({ id: '1' })
    expect(a).toEqual(b)
    expect(Array.isArray(a)).toBe(true)
  })

  it('should use keyFn result directly when provided', () => {
    const keyFn = (args: { id: string }) => [args.id]
    expect(computeArgsKey({ id: '1' }, keyFn)).toEqual(['1'])
  })

  it('should differentiate distinct args', () => {
    expect(computeArgsKey({ id: '1' })).not.toEqual(computeArgsKey({ id: '2' }))
  })
})

describe('computeQueryHash', () => {
  it('should produce a string hash', () => {
    const hash = computeQueryHash('m', 'q', [])
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('should produce same hash for same inputs', () => {
    const key = computeArgsKey({ id: '1' })
    expect(computeQueryHash('m', 'q', key)).toBe(
      computeQueryHash('m', 'q', key)
    )
  })

  it('should produce different hashes for different args', () => {
    expect(computeQueryHash('m', 'q', computeArgsKey({ id: '1' }))).not.toBe(
      computeQueryHash('m', 'q', computeArgsKey({ id: '2' }))
    )
  })

  it('should produce different hashes for different modelName or queryName', () => {
    const key = computeArgsKey(undefined)
    expect(computeQueryHash('m1', 'q', key)).not.toBe(
      computeQueryHash('m2', 'q', key)
    )
    expect(computeQueryHash('m', 'q1', key)).not.toBe(
      computeQueryHash('m', 'q2', key)
    )
  })
})
