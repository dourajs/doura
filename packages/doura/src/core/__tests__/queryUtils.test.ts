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
    expect(computeArgsKey([])).toEqual([])
  })

  it('should return the args tuple directly', () => {
    const a = computeArgsKey(['1', 2])
    const b = computeArgsKey(['1', 2])
    expect(a).toEqual(b)
    expect(a).toEqual(['1', 2])
  })

  it('should support object args as a single tuple element', () => {
    expect(computeArgsKey([{ id: '1' }])).toEqual([{ id: '1' }])
  })

  it('should differentiate distinct args', () => {
    expect(computeArgsKey(['1'])).not.toEqual(computeArgsKey(['2']))
  })
})

describe('computeQueryHash', () => {
  it('should produce a string hash', () => {
    const hash = computeQueryHash('m', 'q', [])
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('should produce same hash for same inputs', () => {
    const key = computeArgsKey([{ id: '1' }])
    expect(computeQueryHash('m', 'q', key)).toBe(
      computeQueryHash('m', 'q', key)
    )
  })

  it('should produce different hashes for different args', () => {
    expect(computeQueryHash('m', 'q', computeArgsKey(['1']))).not.toBe(
      computeQueryHash('m', 'q', computeArgsKey(['2']))
    )
  })

  it('should produce different hashes for different modelName or queryName', () => {
    const key = computeArgsKey([])
    expect(computeQueryHash('m1', 'q', key)).not.toBe(
      computeQueryHash('m2', 'q', key)
    )
    expect(computeQueryHash('m', 'q1', key)).not.toBe(
      computeQueryHash('m', 'q2', key)
    )
  })
})
