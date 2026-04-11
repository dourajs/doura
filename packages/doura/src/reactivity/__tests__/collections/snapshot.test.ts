import { draft, snapshot } from '../../draft'
import { toBase, isModified, isDraft } from '../../common'

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

    // Finalization steals copies from modified draft states
    // and returns them directly without snapshot Proxy wrapping. If child
    // draft proxies are not resolved to plain values, they leak into the
    // result with three consequences:
    //   1. Mutability leak — draft proxy set traps are still active,
    //      allowing accidental mutation of internal draft state
    //   2. Memory leak — draft proxy holds the entire DraftState tree
    //      (root/parent/children/copy), preventing GC
    //   3. Structural sharing breaks — each produce creates new draft
    //      proxies, so referential equality checks always fail
    // The slow path (snapshot Proxy) avoids this by wrapping children
    // through toSnapshot(), which creates read-only snapshot proxies
    // with no set trap and no draft state reference.

    test('Map: should not leak draft proxies into result', () => {
      const base = new Map<string, { value: number }>([
        ['a', { value: 1 }],
        ['b', { value: 2 }],
      ])
      const result = produce(base, (draft) => {
        draft.get('a')!.value = 10
      })
      const aVal = result.get('a')!
      expect(aVal.value).toBe(10)
      expect(aVal).toEqual({ value: 10 })
      // Must not be a draft proxy — isDraft checks for ReactiveFlags.STATE
      // which only exists on draft proxies, not on snapshot proxies or plain objects
      expect(isDraft(aVal)).toBe(false)
      // Unaccessed entry retains original reference (structural sharing)
      expect(result.get('b')).toBe(base.get('b'))
    })

    test('Map: eager finalization resolves undefined key correctly (not confused with NO_KEY sentinel)', () => {
      // undefined is a valid Map key. The draft() function uses a NO_KEY
      // symbol sentinel to distinguish "no key argument" from "key is
      // undefined". This test ensures the sentinel logic is correct.
      const base = new Map<any, { value: number }>([
        [undefined, { value: 1 }],
        ['b', { value: 2 }],
      ])
      const result = produce(base, (draft) => {
        draft.get(undefined)!.value = 10
      })
      const val = result.get(undefined)!
      expect(val.value).toBe(10)
      expect(isDraft(val)).toBe(false)
      expect(result.get('b')).toBe(base.get('b'))
    })

    test('Map: moved draft (delete + set to new key)', () => {
      const base = new Map<string, any>([
        ['a', { value: 1 }],
        ['b', { value: 2 }],
      ])
      const drafted = draft(base)
      const a = drafted.get('a')!
      a.value = 10
      drafted.delete('a')
      drafted.set('c', a)
      const snap = snapshot(drafted, drafted, new Map())
      expect(snap.has('a')).toBe(false)
      expect(snap.get('c')!.value).toBe(10)
      expect(isDraft(snap.get('c')!)).toBe(false)
      expect(snap.get('b')!).toBe(base.get('b'))
    })

    test('Map: multiple references to same draft', () => {
      const base = new Map<string, any>([['a', { value: 1 }]])
      const drafted = draft(base)
      const a = drafted.get('a')!
      a.value = 10
      drafted.set('b', a)
      const snap = snapshot(drafted, drafted, new Map())
      expect(snap.get('a')).toBe(snap.get('b'))
      expect(isDraft(snap.get('a')!)).toBe(false)
      expect(isDraft(snap.get('b')!)).toBe(false)
    })

    test('Map: draft nested in new plain object assigned via set()', () => {
      const base = new Map<string, any>([['a', { value: 1 }]])
      const result = produce(base, (draft) => {
        const a = draft.get('a')!
        a.value = 10
        draft.set('wrapped', { inner: a })
      })
      expect(result.get('wrapped').inner).toEqual({ value: 10 })
      expect(isDraft(result.get('wrapped').inner)).toBe(false)
    })

    test('Set: eager finalization should not leak draft proxies into result', () => {
      const obj1 = { value: 1 }
      const obj2 = { value: 2 }
      const base = new Set([obj1, obj2])
      const result = produce(base, (draft) => {
        const first = draft.values().next().value
        first.value = 10
      })
      const values = Array.from(result)
      expect(values[0]).toEqual({ value: 10 })
      expect(isDraft(values[0])).toBe(false)
      // Unaccessed element retains original reference (structural sharing)
      expect(values[1]).toBe(obj2)
    })

    test('Set: add() with a draft proxy should not leak it into result', () => {
      // When a draft proxy from one Set element is added to another Set,
      // finalization must resolve it. This requires Set add() to call
      // addChildRef so the draft is tracked in the children list.
      const base = {
        set1: new Set([{ value: 1 }]),
        set2: new Set<{ value: number }>(),
      }
      const result = produce(base, (draft) => {
        const item = draft.set1.values().next().value
        item.value = 10
        draft.set2.add(item)
      })
      const set2Values = Array.from(result.set2)
      expect(set2Values[0]).toEqual({ value: 10 })
      expect(isDraft(set2Values[0])).toBe(false)
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
