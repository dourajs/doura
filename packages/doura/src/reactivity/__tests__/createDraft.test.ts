import { draft } from '../draft'
import { isReactive, markRaw, toBase } from '../common'

describe('reactivity/createDraft', () => {
  test('Object', () => {
    const original = { foo: 1 }
    const observed = draft(original)
    expect(observed).not.toBe(original)
    expect(isReactive(observed)).toBe(true)
    expect(isReactive(original)).toBe(false)
    // get
    expect(observed.foo).toBe(1)
    // has
    expect('foo' in observed).toBe(true)
    // ownKeys
    expect(Object.keys(observed)).toEqual(['foo'])
  })

  test('proto', () => {
    const obj = {}
    const reactiveObj = draft(obj)
    expect(isReactive(reactiveObj)).toBe(true)
    // read prop of reactiveObject will cause reactiveObj[prop] to be draft
    // @ts-ignore
    const prototype = reactiveObj['__proto__']
    const otherObj = { data: ['a'] }
    expect(isReactive(otherObj)).toBe(false)
    const reactiveOther = draft(otherObj)
    expect(isReactive(reactiveOther)).toBe(true)
    expect(reactiveOther.data[0]).toBe('a')
  })

  test('nested reactives', () => {
    const original = {
      nested: {
        foo: 1,
      },
      array: [{ bar: 2 }],
    }
    const observed = draft(original)
    expect(isReactive(observed.nested)).toBe(true)
    expect(isReactive(observed.array)).toBe(true)
    expect(isReactive(observed.array[0])).toBe(true)
  })

  // test('observing subtypes of IterableCollections(Map, Set)', () => {
  //   // subtypes of Map
  //   class CustomMap extends Map {}
  //   const cmap = draft(new CustomMap())

  //   expect(cmap instanceof Map).toBe(true)
  //   expect(isReactive(cmap)).toBe(true)

  //   cmap.set('key', {})
  //   expect(isReactive(cmap.get('key'))).toBe(true)

  //   // subtypes of Set
  //   class CustomSet extends Set {}
  //   const cset = draft(new CustomSet())

  //   expect(cset instanceof Set).toBe(true)
  //   expect(isReactive(cset)).toBe(true)

  //   let dummy
  //   effect(() => (dummy = cset.has('value')))
  //   expect(dummy).toBe(false)
  //   cset.add('value')
  //   expect(dummy).toBe(true)
  //   cset.delete('value')
  //   expect(dummy).toBe(false)
  // })

  // test('observing subtypes of WeakCollections(WeakMap, WeakSet)', () => {
  //   // subtypes of WeakMap
  //   class CustomMap extends WeakMap {}
  //   const cmap = draft(new CustomMap())

  //   expect(cmap instanceof WeakMap).toBe(true)
  //   expect(isReactive(cmap)).toBe(true)

  //   const key = {}
  //   cmap.set(key, {})
  //   expect(isReactive(cmap.get(key))).toBe(true)

  //   // subtypes of WeakSet
  //   class CustomSet extends WeakSet {}
  //   const cset = draft(new CustomSet())

  //   expect(cset instanceof WeakSet).toBe(true)
  //   expect(isReactive(cset)).toBe(true)

  //   let dummy
  //   effect(() => (dummy = cset.has(key)))
  //   expect(dummy).toBe(false)
  //   cset.add(key)
  //   expect(dummy).toBe(true)
  //   cset.delete(key)
  //   expect(dummy).toBe(false)
  // })

  test('observed value should not proxy mutations to original (Object)', () => {
    const original: any = { foo: 1 }
    const observed = draft(original)
    // set
    observed.bar = 1
    expect(observed.bar).toBe(1)
    expect(original.bar).toBe(undefined)
    // delete
    delete observed.foo
    expect('foo' in observed).toBe(false)
    expect('foo' in original).toBe(true)
  })

  test('original value change should reflect in observed value (Object)', () => {
    const original: any = { foo: 1 }
    const observed = draft(original)
    // set
    original.bar = 1
    expect(original.bar).toBe(1)
    expect(observed.bar).toBe(1)
    // delete
    delete original.foo
    expect('foo' in original).toBe(false)
    expect('foo' in observed).toBe(false)
  })

  test('setting a property with an unobserved value should be wrapped with draft', () => {
    const observed = draft<{ foo?: object }>({})
    const raw = { n: Math.random() }
    observed.foo = raw
    expect(observed.foo).toEqual(raw)
    expect(isReactive(observed.foo)).toBe(true)
  })

  test('observing already observed value should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = draft(original)
    const observed2 = draft(observed)
    expect(observed2).toBe(observed)
  })

  test('observing the same value multiple times should return different Proxy', () => {
    const original = { foo: 1 }
    const observed = draft(original)
    const observed2 = draft(original)
    expect(observed2).not.toBe(observed)
  })

  test('toBase', () => {
    const original = { foo: 1 }
    const observed = draft(original)
    expect(toBase(observed)).toBe(original)
    expect(toBase(original)).toBe(original)
  })

  test('toBase on object using draft as prototype', () => {
    const original = draft({})
    const obj = Object.create(original)
    const raw = toBase(obj)
    expect(raw).toBe(obj)
    expect(raw).not.toBe(toBase(original))
  })

  test('non-observable values', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const originNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    const assertValue = (value: any) => {
      draft(value)
      warn.mock.calls[warn.mock.calls.length - 1][0].includes(
        `value cannot be made draft: ${String(value)}`
      )
    }

    // number
    assertValue(1)
    // string
    assertValue('foo')
    // boolean
    assertValue(false)
    // null
    assertValue(null)
    // undefined
    assertValue(undefined)
    // symbol
    const s = Symbol()
    assertValue(s)

    // built-ins should work and return same value
    const p = Promise.resolve()
    expect(draft(p)).toBe(p)
    const r = new RegExp('')
    expect(draft(r)).toBe(r)
    const d = new Date()
    expect(draft(d)).toBe(d)

    warn.mockRestore()
    process.env.NODE_ENV = originNodeEnv
  })

  test('markRaw', () => {
    const obj = draft({
      foo: { a: 1 },
      bar: markRaw({ b: 2 }),
    })
    expect(isReactive(obj.foo)).toBe(true)
    expect(isReactive(obj.bar)).toBe(false)
  })

  test('should not observe non-extensible objects', () => {
    const obj = draft({
      foo: Object.preventExtensions({ a: 1 }),
      // sealed or frozen objects are considered non-extensible as well
      bar: Object.freeze({ a: 1 }),
      baz: Object.seal({ a: 1 }),
    })
    expect(isReactive(obj.foo)).toBe(false)
    expect(isReactive(obj.bar)).toBe(false)
    expect(isReactive(obj.baz)).toBe(false)
  })

  test('should not observe objects with __v_skip', () => {
    const original = {
      foo: 1,
      __r_skip: true,
    }
    const observed = draft(original)
    expect(isReactive(observed)).toBe(false)
  })
})
