import { draft, snapshot } from '../draft'
import { isModified } from '../common'
import { each } from '../../utils'

const produce = <T extends any = any>(value: T, cb: (v: T) => void) => {
  const obj = draft(value as any)
  cb(obj)

  if (!isModified(obj)) {
    return value
  }

  return snapshot(obj, obj)
}

function enumerableOnly(x: any) {
  const copy = Array.isArray(x) ? x.slice() : Object.assign({}, x)
  each(copy, (prop, value) => {
    if (value && typeof value === 'object') {
      copy[prop] = enumerableOnly(value)
    }
  })
  return copy
}

function isEnumerable(base: any, prop: PropertyKey) {
  const desc = Object.getOwnPropertyDescriptor(base, prop)
  return desc && desc.enumerable ? true : false
}

describe(`reactivity/draft`, () => {
  describe(`base functionality`, () => {
    let baseState: any
    let origBaseState: any

    class Foo {}
    function createBaseState() {
      const data = {
        anInstance: new Foo(),
        anArray: [3, 2, { c: 3 }, 1],
        aMap: new Map([
          ['jedi', { name: 'Luke', skill: 10 }],
          ['jediTotal', 42],
          ['force', "these aren't the droids you're looking for"],
        ] as [string, any][]),
        aSet: new Set([
          'Luke',
          42,
          {
            jedi: 'Yoda',
          },
        ]),
        aProp: 'hi',
        anObject: {
          nested: {
            yummie: true,
          },
          coffee: false,
        },
      }
      return data
    }

    beforeEach(() => {
      origBaseState = baseState = createBaseState()
    })

    it('returns the original state when no changes are made', () => {
      const nextState = produce(baseState, (s) => {
        expect(s.aProp).toBe('hi')
        expect(s.anObject.nested).toMatchObject({ yummie: true })
      })
      expect(nextState).toBe(baseState)
    })

    it('does structural sharing', () => {
      const random = Math.random()
      const nextState = produce(baseState, (s) => {
        s.aProp = random
      })
      expect(nextState).not.toBe(baseState)
      expect(nextState.aProp).toBe(random)
      expect(nextState.nested).toBe(baseState.nested)
    })

    it('deep change bubbles up', () => {
      const nextState = produce(baseState, (s) => {
        s.anObject.nested.yummie = false
      })
      expect(nextState).not.toBe(baseState)
      expect(nextState.anObject).not.toBe(baseState.anObject)
      expect(baseState.anObject.nested.yummie).toBe(true)
      expect(nextState.anObject.nested.yummie).toBe(false)
      expect(nextState.anArray).toBe(baseState.anArray)
    })

    it('can add props', () => {
      const nextState = produce(baseState, (s) => {
        s.anObject.cookie = { tasty: true }
      })
      expect(nextState).not.toBe(baseState)
      expect(nextState.anObject).not.toBe(baseState.anObject)
      expect(nextState.anObject.nested).toBe(baseState.anObject.nested)
      expect(nextState.anObject.cookie).toEqual({ tasty: true })
    })

    it('can delete props', () => {
      const nextState = produce(baseState, (s) => {
        delete s.anObject.nested
      })
      expect(nextState).not.toBe(baseState)
      expect(nextState.anObject).not.toBe(baseState.anObject)
      expect(nextState.anObject.nested).toBe(undefined)
    })

    // Found by: https://github.com/mweststrate/immer/pull/267
    it('can delete props added in the producer', () => {
      const nextState = produce(baseState, (s) => {
        s.anObject.test = true
        delete s.anObject.test
      })
      expect(nextState).not.toBe(baseState)
      expect(nextState).toEqual(baseState)
    })

    // Found by: https://github.com/mweststrate/immer/issues/328
    it('can set a property that was just deleted', () => {
      const baseState = { a: 1 } as any
      const nextState = produce(baseState, (s) => {
        delete s.a
        s.a = 2
      })
      expect(nextState.a).toBe(2)
    })

    it('can set a property to its original value after deleting it', () => {
      const baseState = { a: { b: 1 } } as any
      const nextState = produce(baseState, (s) => {
        const a = s.a
        delete s.a
        s.a = a
      })
      expect(nextState).not.toBe(baseState)
      expect(nextState).toEqual(baseState)
    })

    it('can get property descriptors', () => {
      const getDescriptor = Object.getOwnPropertyDescriptor
      const baseState = [{ a: 1 }] as any
      produce(baseState, (arr) => {
        const obj = arr[0]
        const desc = {
          configurable: true,
          enumerable: true,
          writable: true,
        }

        // Known property
        expect(getDescriptor(obj, 'a')).toMatchObject(desc)
        expect(getDescriptor(arr, 0)).toMatchObject(desc)

        // Deleted property
        delete obj.a
        arr.pop()
        expect(getDescriptor(obj, 'a')).toBeUndefined()
        expect(getDescriptor(arr, 0)).toBeUndefined()

        // Unknown property
        expect(getDescriptor(obj, 'b')).toBeUndefined()
        expect(getDescriptor(arr, 100)).toBeUndefined()

        // Added property
        obj.b = 2
        arr[100] = 1
        expect(getDescriptor(obj, 'b')).toBeDefined()
        expect(getDescriptor(arr, 100)).toBeDefined()
      })
    })

    describe('array drafts', () => {
      it('supports Array.isArray()', () => {
        const nextState = produce(baseState, (s) => {
          expect(Array.isArray(s.anArray)).toBeTruthy()
          s.anArray.push(1)
        })
        expect(Array.isArray(nextState.anArray)).toBeTruthy()
      })

      it('supports index access', () => {
        const value = baseState.anArray[0]
        const nextState = produce(baseState, (s) => {
          expect(s.anArray[0]).toBe(value)
        })
        expect(nextState).toBe(baseState)
      })

      it('supports iteration', () => {
        const base = [
          { id: 1, a: 1 },
          { id: 2, a: 1 },
        ]
        const findById = (collection: any, id: any) => {
          for (const item of collection) {
            if (item.id === id) return item
          }
          return null
        }
        const result = produce(base, (draft) => {
          const obj1 = findById(draft, 1)
          const obj2 = findById(draft, 2)
          obj1.a = 2
          obj2.a = 2
        })
        expect(result[0].a).toEqual(2)
        expect(result[1].a).toEqual(2)
      })

      it('can assign an index via bracket notation', () => {
        const nextState = produce(baseState, (s) => {
          s.anArray[3] = true
        })
        expect(nextState).not.toBe(baseState)
        expect(nextState.anArray).not.toBe(baseState.anArray)
        expect(nextState.anArray[3]).toEqual(true)
      })

      it('can use splice() to both add and remove items', () => {
        const nextState = produce(baseState, (s) => {
          s.anArray.splice(1, 1, 'a', 'b')
        })
        expect(nextState.anArray).not.toBe(baseState.anArray)
        expect(nextState.anArray[1]).toBe('a')
        expect(nextState.anArray[2]).toBe('b')
      })

      it('can truncate via the length property', () => {
        const baseLength = baseState.anArray.length
        const nextState = produce(baseState, (s) => {
          s.anArray.length = baseLength - 1
        })
        expect(nextState.anArray).not.toBe(baseState.anArray)
        expect(nextState.anArray.length).toBe(baseLength - 1)
      })

      it('can extend via the length property', () => {
        const baseLength = baseState.anArray.length
        const nextState = produce(baseState, (s) => {
          s.anArray.length = baseLength + 1
        })
        expect(nextState.anArray).not.toBe(baseState.anArray)
        expect(nextState.anArray.length).toBe(baseLength + 1)
      })

      // Reported here: https://github.com/mweststrate/immer/issues/116
      it('can pop then push', () => {
        const base = [1, 2, 3]
        const origin = base
        const nextState = produce(base, (s) => {
          s.pop()
          s.push(100)
        })
        expect(base).toEqual(origin)
        expect(nextState).toEqual([1, 2, 100])
      })

      it('can be sorted', () => {
        const baseState = [3, 1, 2]
        const nextState = produce(baseState, (s) => {
          s.sort()
        })
        expect(nextState).not.toBe(baseState)
        expect(nextState).toEqual([1, 2, 3])
      })

      it('supports modifying nested objects', () => {
        const baseState = [{ a: 1 }, {}] as any
        const nextState = produce(baseState, (s) => {
          s[0].a++
          s[1].a = 0
        })
        expect(nextState).not.toBe(baseState)
        expect(nextState[0].a).toBe(2)
        expect(nextState[1].a).toBe(0)
      })

      it('never preserves non-numeric properties', () => {
        const baseState: any = []
        baseState.x = 7
        const nextState = produce(baseState, (s) => {
          s.push(3)
        })
        expect('x' in nextState).toBeFalsy()
      })

      it('throws when a non-numeric property is added', () => {
        expect(() => {
          produce([] as any, (d) => {
            d.x = 3
          })
        }).not.toThrow()
      })

      it('throws when a non-numeric property is deleted', () => {
        expect(() => {
          const baseState: any = []
          baseState.x = 7
          produce(baseState, (d) => {
            delete d.x
          })
        }).not.toThrow()
      })
    })

    it('preserves symbol properties', () => {
      const test = Symbol('test')
      const baseState = { [test]: true } as any
      const nextState = produce(baseState, (s) => {
        expect(s[test]).toBeTruthy()
        s.foo = true
      })
      expect(nextState).toEqual({
        [test]: true,
        foo: true,
      })
    })

    it('preserves non-enumerable properties', () => {
      const baseState = {} as any
      // Non-enumerable object property
      Object.defineProperty(baseState, 'foo', {
        value: { a: 1 },
        enumerable: false,
        configurable: true,
        writable: true,
      })
      // Non-enumerable primitive property
      Object.defineProperty(baseState, 'bar', {
        value: 1,
        enumerable: false,
        configurable: true,
        writable: true,
      })
      const nextState = produce(baseState, (s) => {
        expect(s.foo).toBeTruthy()
        expect(isEnumerable(s, 'foo')).toBeFalsy()
        s.bar++
        expect(isEnumerable(s, 'foo')).toBeFalsy()
        s.foo.a++
        expect(isEnumerable(s, 'foo')).toBeFalsy()
      })
      expect(nextState.foo).toBeTruthy()
      expect(isEnumerable(nextState, 'foo')).toBeFalsy()
    })

    it('can work with own computed props', () => {
      const baseState = {
        x: 1,
        get y() {
          return this.x
        },
        set y(v) {
          this.x = v
        },
      }

      const nextState = produce(baseState, (d) => {
        expect(d.y).toBe(1)
        d.x = 2
        expect(d.x).toBe(2)
        expect(d.y).toBe(1) // this has been copied!
        d.y = 3
        expect(d.x).toBe(2)
      })
      expect(baseState.x).toBe(1)
      expect(baseState.y).toBe(1)

      expect(nextState.x).toBe(2)
      expect(nextState.y).toBe(3)
      nextState.y = 4 // decoupled now!
      expect(nextState.y).toBe(4)
      expect(nextState.x).toBe(2)
      expect(Object.getOwnPropertyDescriptor(nextState, 'y')!.value).toBe(4)
    })

    it('can work with class with computed props', () => {
      class State {
        x = 1

        set y(v) {
          this.x = v
        }

        get y() {
          return this.x
        }
      }

      const baseState = new State()
      const nextState = produce(baseState, (d) => {
        expect(d.y).toBe(1)
        d.y = 2
        expect(d.x).toBe(2)
        expect(d.y).toBe(2)
        expect(Object.getOwnPropertyDescriptor(d, 'y')).toBeUndefined()
      })
      expect(baseState.x).toBe(1)
      expect(baseState.y).toBe(1)

      expect(nextState.x).toBe(2)
      expect(nextState.y).toBe(2)
      expect(Object.getOwnPropertyDescriptor(nextState, 'y')).toBeUndefined()
    })

    it('allows inherited computed properties', () => {
      const proto: any = {}
      Object.defineProperty(proto, 'foo', {
        get() {
          return this.bar
        },
        set(val) {
          this.bar = val
        },
      })
      const baseState = Object.create(proto)
      produce(baseState, (s) => {
        expect(s.bar).toBeUndefined()
        s.foo = {}
        expect(s.bar).toBeDefined()
        expect(s.foo).toBe(s.bar)
      })
    })

    it('supports a base state with multiple references to an object', () => {
      const obj: any = {}
      const res = produce({ a: obj, b: obj }, (d) => {
        // Two drafts are created for each occurrence of an object in the base state.
        expect(d.a).not.toBe(d.b)
        d.a.z = true
        expect(d.b.z).toBeUndefined()
      })
      // res.b is a proxy
      expect(res.b).not.toBe(obj)
      expect(res.a).not.toBe(res.b)
      expect(res.a.z).toBeTruthy()
    })

    it('supports a base state with deep level multiple references to an object No access same references', () => {
      const obj: any = {}
      const base = { a: obj, b: { c: obj } }
      const res = produce(base, (d) => {
        d.a.z = true
      })
      expect(res.a.z).toBeTruthy()
      expect(res.a).not.toBe(res.b.c)
    })

    // NOTE: Except the root draft.
    it('supports multiple references to any modified draft', () => {
      const next = produce({ a: { b: 1 } } as any, (d) => {
        d.a.b++
        d.b = d.a
      })
      expect(next.a).toBe(next.b)
    })

    it('can rename nested objects (no changes)', () => {
      const nextState = produce({ obj: {} } as any, (s) => {
        s.foo = s.obj
        delete s.obj
      })
      expect(nextState).toEqual({ foo: {} })
    })

    // Very similar to the test before, but the reused object has one
    // property changed, one added, and one removed.
    it('can rename nested objects (with changes)', () => {
      const nextState = produce({ obj: { a: 1, b: 1 } } as any, (s) => {
        s.obj.a = true // change
        delete s.obj.b // delete
        s.obj.c = true // add

        s.foo = s.obj
        delete s.obj
      })
      expect(nextState).toEqual({ foo: { a: true, c: true } })
    })

    it('can nest a draft in a new object', () => {
      const baseState: any = { obj: {} }
      const obj = baseState.obj
      const nextState = produce(baseState, (s) => {
        s.foo = { bar: s.obj }
        delete s.obj
      })
      expect(nextState.foo.bar).toEqual(obj)
    })

    it('can nest a modified draft in a new object', () => {
      const nextState = produce({ obj: { a: 1, b: 1 } } as any, (s) => {
        s.obj.a = true // change
        delete s.obj.b // delete
        s.obj.c = true // add

        s.foo = { bar: s.obj }
        delete s.obj
      })
      expect(nextState).toEqual({ foo: { bar: { a: true, c: true } } })
    })

    it('supports assigning undefined to an existing property', () => {
      const nextState = produce(baseState, (s) => {
        s.aProp = undefined
      })
      expect(nextState).not.toBe(baseState)
      expect(nextState.aProp).toBe(undefined)
    })

    it('supports assigning undefined to a new property', () => {
      const baseState = {} as any
      const nextState = produce(baseState, (s) => {
        s.aProp = undefined
      })
      expect(nextState).not.toBe(baseState)
      expect(nextState.aProp).toBe(undefined)
    })

    it('can access a child draft that was created before the draft was modified', () => {
      produce({ a: {} } as any, (s) => {
        const before = s.a
        s.b = 1
        expect(s.a).toBe(before)
      })
    })

    it('should reflect all changes made in the draft immediately', () => {
      produce(baseState, (draft) => {
        draft.anArray[0] = 5
        draft.anArray.unshift('test')
        expect(enumerableOnly(draft.anArray)).toEqual([
          'test',
          5,
          2,
          { c: 3 },
          1,
        ])
        draft.stuffz = 'coffee'
        expect(draft.stuffz).toBe('coffee')
      })
    })

    it('should handle constructor correctly', () => {
      const baseState = {
        arr: new Array(),
        obj: new Object(),
      } as any
      const result = produce(baseState, (draft) => {
        draft.arrConstructed = draft.arr.constructor(1)
        draft.objConstructed = draft.obj.constructor(1)
      })
      expect(result.arrConstructed).toEqual(new Array().constructor(1))
      expect(result.objConstructed).toEqual(new Object().constructor(1))
    })

    it('should handle equality correctly - 1', () => {
      const baseState = {
        y: 3 / 0,
        z: NaN,
      }
      const nextState = produce(baseState, (draft) => {
        draft.y = 4 / 0
        draft.z = NaN
      })
      expect(nextState).toBe(baseState)
    })

    it('should handle equality correctly - 2', () => {
      const baseState = {
        x: -0,
      }
      const nextState = produce(baseState, (draft) => {
        draft.x = +0
      })
      expect(nextState).not.toBe(baseState)
      expect(nextState).not.toEqual({
        x: -0,
      })
    })

    it("supports the 'in' operator", () => {
      produce(baseState, (draft) => {
        // Known property
        expect('anArray' in draft).toBe(true)
        expect(Reflect.has(draft, 'anArray')).toBe(true)

        // Unknown property
        expect('bla' in draft).toBe(false)
        expect(Reflect.has(draft, 'bla')).toBe(false)

        // Known index
        expect(0 in draft.anArray).toBe(true)
        expect('0' in draft.anArray).toBe(true)
        expect(Reflect.has(draft.anArray, 0)).toBe(true)
        expect(Reflect.has(draft.anArray, '0')).toBe(true)

        // Unknown index
        expect(17 in draft.anArray).toBe(false)
        expect('17' in draft.anArray).toBe(false)
        expect(Reflect.has(draft.anArray, 17)).toBe(false)
        expect(Reflect.has(draft.anArray, '17')).toBe(false)
      })
    })

    it("'this' should not be bound anymore - 1", () => {
      const base = { x: 3 } as any
      produce(base, function (this: any) {
        expect(this).toBe(undefined)
      })
    })

    // See here: https://github.com/mweststrate/immer/issues/89
    it('supports the spread operator', () => {
      const base = { foo: { x: 0, y: 0 }, bar: [0, 0] } as any
      const result = produce(base, (draft) => {
        draft.foo = { x: 1, ...draft.foo, y: 1 }
        draft.bar = [1, ...draft.bar, 1]
      })
      expect(result).toEqual({
        foo: { x: 0, y: 1 },
        bar: [1, 0, 0, 1],
      })
    })

    // it('processes with lodash.set', () => {
    //   const base = [{ id: 1, a: 1 }] as any
    //   const result = produce(base, (draft) => {
    //     lodash.set(draft, '[0].a', 2)
    //   })
    //   expect(base[0].a).toEqual(1)
    //   expect(result[0].a).toEqual(2)
    // })

    // it('processes with lodash.find', () => {
    //   const base = [{ id: 1, a: 1 }]as any;
    //   const result = produce(base, (draft) => {
    //     const obj1 = lodash.find(draft, { id: 1 })
    //     lodash.set(obj1, 'a', 2)
    //   })
    //   expect(base[0].a).toEqual(1)
    //   expect(result[0].a).toEqual(2)
    // })

    it('draft external data', () => {
      const externalData = { x: 3 }
      const base = {} as any
      const next = produce(base, (draft) => {
        // potentially, we *could* draft external data automatically, but only if those statements are not switched...
        draft.y = externalData
        draft.y.x += 1
        externalData.x += 2
      })
      expect(next).toEqual({ y: { x: 4 } })
      expect(externalData.x).toBe(5)
      expect(next.y).not.toBe(externalData)
    })

    it('does not create new state unnecessary, #491', () => {
      const a = { highlight: true }
      const next1 = produce(a, (draft) => {
        draft.highlight = false
        draft.highlight = true
      })
      // See explanation in issue
      expect(next1).not.toBe(a)

      const next2 = produce(a, (draft) => {
        draft.highlight = true
      })
      expect(next2).toBe(a)
    })

    it('cannot always detect noop assignments - 0', () => {
      const baseState = { x: { y: 3 } }
      const nextState = produce(baseState, (d) => {
        const a = d.x
        d.x = a
      })
      expect(nextState).toBe(baseState)
    })

    it('cannot always detect noop assignments - 1', () => {
      const baseState = { x: { y: 3 } } as any
      const nextState = produce(baseState, (d) => {
        const a = d.x
        d.x = 4
        d.x = a
      })
      // Ideally, this should actually be the same instances
      // but this would be pretty expensive to detect,
      // so we don't atm
      expect(nextState).not.toBe(baseState)
    })

    it('cannot always detect noop assignments - 2', () => {
      const baseState = { x: { y: 3 } } as any
      const nextState = produce(baseState, (d) => {
        const a = d.x
        const _stuff = a.y + 3
        d.x = 4
        d.x = a
      })
      // Ideally, this should actually be the same instances
      // but this would be pretty expensive to detect,
      // so we don't atm
      expect(nextState).not.toBe(baseState)
    })

    it('cannot always detect noop assignments - 3', () => {
      const baseState = { x: 3 }
      const nextState = produce(baseState, (d) => {
        d.x = 3
      })
      expect(nextState).toBe(baseState)
    })

    it('cannot always detect noop assignments - 4', () => {
      const baseState = { x: 3 }
      const nextState = produce(baseState, (d) => {
        d.x = 4
        d.x = 3
      })
      // Ideally, this should actually be the same instances
      // but this would be pretty expensive to detect,
      // so we don't atm
      expect(nextState).not.toBe(baseState)
    })

    afterEach(() => {
      expect(baseState).toBe(origBaseState)
    })
  })

  describe.skip('edge case', () => {
    it.only('supports modifying nested objects', () => {
      const baseState = [{ a: 1 }, {}] as any
      const nextState = produce(baseState, (s) => {
        s[0].a++
        s[0].b = { c: s[0] }
      })
      expect(nextState).not.toBe(baseState)
      expect(nextState[0].a).toBe(2)
      expect(nextState[0].b.c.a).toBe(2)
    })
  })
})

describe(`reactivity/snapshot`, () => {
  it('should work', () => {
    const state = {
      aProp: 'hi' as any,
      anArray: [3, 2, { c: 3 }, 1] as any[],
      anObject: {
        nested: {
          yummie: true,
        },
        coffee: false,
      },
    }

    const drafted = draft(state)
    drafted.aProp = 1
    drafted.anArray[0] = 1
    drafted.anObject.nested.yummie = false

    const value = snapshot({ ...drafted }, drafted)
    expect(value.aProp).toEqual(1)
    expect(value.anArray[0]).toEqual(1)
    expect(value.anObject.nested.yummie).toEqual(false)

    drafted.aProp = 2
    drafted.anArray[0] = 2
    drafted.anObject.nested.yummie = true

    // modification should not reflect to snapshot
    expect(value.aProp).toEqual(1)
    expect(value.anArray[0]).toEqual(1)
    expect(value.anObject.nested.yummie).toEqual(false)
  })

  it("should not visit objects which aren't modified", () => {
    const newData: any = {}
    Object.defineProperty(newData, 'x', {
      enumerable: true,
      get() {
        throw new Error('visited!')
      },
    })

    const state = {
      aProp: 'hi' as any,
      anObject: {
        get nested() {
          throw new Error('visited!')
        },
        coffee: false,
      },
      data: null as any,
    }

    const drafted = draft(state)
    drafted.data = newData
    // read anObject
    void drafted.anObject

    const run = () => {
      snapshot(drafted, drafted)
    }
    expect(run).not.toThrow()
  })
})
