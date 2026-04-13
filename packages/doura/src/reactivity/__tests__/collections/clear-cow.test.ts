import { draft, snapshot } from '../../draft'
import { toBase } from '../../common'

/**
 * Failure cases for collection clear() violating copy-on-write.
 *
 * The bug: when clear() is the FIRST mutation on a collection that was
 * initialized with data, `latest(state)` returns `state.base` (because
 * no prior write has created `state.copy`). The current code calls
 * `target.clear()` on this value BEFORE `prepareCopy()`, which directly
 * mutates the original base object.
 */
describe('collection clear() copy-on-write violation', () => {
  describe('Map', () => {
    it('clear() should not mutate the original base Map', () => {
      const original = new Map([
        ['a', 1],
        ['b', 2],
      ])
      const proxy = draft(original)

      proxy.clear()

      // The original Map must remain untouched
      expect(original.size).toBe(2)
      expect(original.get('a')).toBe(1)
      expect(original.get('b')).toBe(2)
    })

    it('snapshot after clear() should be empty while base is preserved', () => {
      const original = new Map([
        ['a', 1],
        ['b', 2],
      ])
      const proxy = draft(original)

      proxy.clear()

      const snap = snapshot(proxy, proxy)
      // Snapshot should reflect the clear
      expect((snap as Map<string, number>).size).toBe(0)
      // Original should be untouched
      expect(original.size).toBe(2)
    })
  })

  describe('Set', () => {
    it('clear() should not mutate the original base Set', () => {
      const original = new Set([1, 2, 3])
      const proxy = draft(original)

      proxy.clear()

      // The original Set must remain untouched
      expect(original.size).toBe(3)
      expect(original.has(1)).toBe(true)
      expect(original.has(2)).toBe(true)
      expect(original.has(3)).toBe(true)
    })

    it('snapshot after clear() should be empty while base is preserved', () => {
      const original = new Set([1, 2, 3])
      const proxy = draft(original)

      proxy.clear()

      const snap = snapshot(proxy, proxy)
      // Snapshot should reflect the clear
      expect((snap as Set<number>).size).toBe(0)
      // Original should be untouched
      expect(original.size).toBe(3)
    })
  })
})
