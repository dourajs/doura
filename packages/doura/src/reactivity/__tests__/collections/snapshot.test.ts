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

    test('should not throw', () => {
      const project = produce(new Map(), (draft) => {
        draft.set('bar1', { blocked: false })
        draft.set('bar2', { blocked: false })
      })

      // Read before write -- no error
      produce(project, (draft) => {
        const bar1 = draft.get('bar1')
        const bar2 = draft.get('bar2')
        bar1.blocked = true
        bar2.blocked = true
      })

      // Read/write interleaved -- error
      produce(project, (draft) => {
        const bar1 = draft.get('bar1')
        bar1.blocked = true
        const bar2 = draft.get('bar2')
        bar2.blocked = true
      })

      expect(true).toBe(true)
    })

    test('nested map ', () => {
      const obj = {
        map: new Map([
          [
            'a',
            new Map([
              ['b', true],
              ['c', true],
              ['d', true],
            ]),
          ],
          ['b', new Map([['a', true]])],
          ['c', new Map([['a', true]])],
          ['d', new Map([['a', true]])],
        ]),
      }
      const result = produce(obj, (draft) => {
        const aMap = draft.map.get('a')!
        aMap.forEach((_, other) => {
          const otherMap = draft.map.get(other)!
          otherMap.delete('a')
        })
      })
      expect(result).toEqual({
        map: new Map([
          [
            'a',
            new Map([
              ['b', true],
              ['c', true],
              ['d', true],
            ]),
          ],
          ['b', new Map()],
          ['c', new Map()],
          ['d', new Map()],
        ]),
      })
    })

    test('nested map 1', () => {
      const obj = {
        map: new Map([
          [
            'a',
            new Map([
              ['b', true],
              ['c', true],
              ['d', true],
            ]),
          ],
          ['b', new Map([['a', true]])],
          ['c', new Map([['a', true]])],
          ['d', new Map([['a', true]])],
        ]),
      }
      const obj1 = produce(obj, (_draft) => {})
      const result = produce(obj1, (draft) => {
        const aMap = draft.map.get('a')
        aMap.forEach((_: any, other: any) => {
          const otherMap = draft.map.get(other)
          otherMap.delete('a')
        })
      })
      expect(result).toEqual({
        map: new Map([
          [
            'a',
            new Map([
              ['b', true],
              ['c', true],
              ['d', true],
            ]),
          ],
          ['b', new Map([])],
          ['c', new Map([])],
          ['d', new Map([])],
        ]),
      })
    })

    test('should work after iterating over a Set', () => {
      const base = new Set([1, 2])
      const set = produce(base, (draftSet) => {
        expect(Array.from(draftSet)).toEqual([1, 2])
        draftSet.add(3)
      })
      expect(Array.from(set).sort()).toEqual([1, 2, 3])
    })

    test('new map key with value=undefined', () => {
      const map = new Map()
      const map1 = produce(map, (draft) => {
        draft.set('key', undefined)
      })
      expect(map1.has('key')).toBe(true)
      expect(map1.get('key')).toBe(undefined)
    })

    test('clear map & set', () => {
      const map = new Map([
        ['a', 'b'],
        ['b', 'c'],
      ])
      let result = produce(map, (draft) => {
        draft.clear()
      })
      expect(result).toEqual(new Map())

      const set = new Set(['a', 'b'])
      result = produce(set, (draft) => {
        draft.clear()
      })
      expect(result).toEqual(new Set())
    })

    test('Clearing empty Set&Map should be noop', () => {
      const map = new Map()
      let result = produce(map, (draft) => {
        draft.clear()
      })
      expect(result).toBe(map)

      const set = new Set()
      result = produce(set, (draft) => {
        draft.clear()
      })
      expect(result).toBe(set)
    })
  })
})
