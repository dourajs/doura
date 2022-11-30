import { draft, snapshot } from '../../draft'
import { toBase, isModified } from '../../common'

describe('reactivity/collections', () => {
  describe('snapshot', () => {
    const produce = <T extends any = any>(value: T, cb: (v: T) => void) => {
      const obj = draft(value as any)
      cb(obj)

      if (!isModified(obj)) {
        return value
      }

      return snapshot(obj, obj)
    }

    describe(`complex nesting map / set / object`, () => {
      const a = { a: 1 }
      const b = { b: 2 }
      const c = { c: 3 }
      const set1: Set<any> = new Set([a, b])
      const set2: Set<any> = new Set([c])
      const map = new Map([
        ['set1', set1],
        ['set2', set2],
      ])
      const base = { map }

      function first(set: Set<any>) {
        return Array.from(set.values())[0]
      }

      function second(set: Set<any>) {
        return Array.from(set.values())[1]
      }

      test(`modify deep object`, () => {
        const res = produce(base, (draft) => {
          const v = first(draft.map.get('set1')!)
          expect(toBase(v)).toBe(a)
          expect(v).toEqual(a)
          expect(v).not.toBe(a)
          v.a++
        })
        expect(res).toMatchSnapshot()
        expect(a.a).toBe(1)
        expect(base.map.get('set1')).toBe(set1)
        expect(first(base.map.get('set1')!)).toBe(a)
        expect(res).not.toBe(base)
        expect(res.map).not.toBe(base.map)
        expect(res.map.get('set1')).not.toBe(base.map.get('set1'))
        expect(second(base.map.get('set1')!)).toBe(b)
        expect(base.map.get('set2')).toBe(set2)
        expect(first(res.map.get('set1'))).toEqual({ a: 2 })
      })

      test(`modify deep object - keep value`, () => {
        const res = produce(base, (draft) => {
          const v = first(draft.map.get('set1')!)
          expect(toBase(v)).toBe(a)
          expect(v).toEqual(a)
          expect(v).not.toBe(a)
          v.a = 1 // same value
        })
        expect(a.a).toBe(1)
        expect(base.map.get('set1')).toBe(set1)
        expect(first(base.map.get('set1')!)).toBe(a)
        expect(res).toBe(base)
        expect(res.map).toBe(base.map)
        expect(res.map.get('set1')).toBe(base.map.get('set1'))
        expect(first(res.map.get('set1'))).toBe(a)
        expect(second(base.map.get('set1')!)).toBe(b)
        expect(base.map.get('set2')).toBe(set2)
      })
    })
  })
})
