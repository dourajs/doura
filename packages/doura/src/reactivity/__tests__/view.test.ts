import { draft } from '../draft'
import { view } from '../view'
import { effect } from '../effect'

// should compute again when deps change
// return different reference when deps change

describe('reactivity/view', () => {
  it('should return updated value', () => {
    const value = draft<{ foo?: number }>({})
    const cValue = view(() => value.foo)
    expect(cValue.value).toBe(undefined)
    value.foo = 1
    expect(cValue.value).toBe(1)
  })

  it('should compute lazily', () => {
    const value = draft<{ foo?: number }>({})
    const getter = jest.fn(() => value.foo)
    const cValue = view(getter)

    // lazy
    expect(getter).not.toHaveBeenCalled()

    expect(cValue.value).toBe(undefined)
    expect(getter).toHaveBeenCalledTimes(1)

    // should not compute again
    cValue.value
    expect(getter).toHaveBeenCalledTimes(1)

    // should not compute until needed
    value.foo = 1
    expect(getter).toHaveBeenCalledTimes(1)

    // now it should compute
    expect(cValue.value).toBe(1)
    expect(getter).toHaveBeenCalledTimes(2)

    // should not compute again
    cValue.value
    expect(getter).toHaveBeenCalledTimes(2)
  })

  it.skip('should trigger parent object change when child props is modified', () => {
    const value = draft<{ a: { b: number } }>({
      a: {
        b: 0,
      },
    })
    const getter = jest.fn(() => value.a)
    const cValue = view(getter)

    // lazy
    expect(getter).not.toHaveBeenCalled()

    expect(cValue.value).toEqual({ b: 0 })
    expect(getter).toHaveBeenCalledTimes(1)

    // should not compute again
    cValue.value
    expect(getter).toHaveBeenCalledTimes(1)

    // should not compute until needed
    value.a.b = 1
    expect(getter).toHaveBeenCalledTimes(1)

    // now it should compute
    expect(cValue.value).toEqual({
      b: 1,
    })
    expect(getter).toHaveBeenCalledTimes(2)

    // should not compute again
    cValue.value
    expect(getter).toHaveBeenCalledTimes(2)
  })

  it('should trigger effect', () => {
    const value = draft<{ foo?: number }>({})
    const cValue = view(() => value.foo)
    let dummy
    effect(() => {
      dummy = cValue.value
    })
    expect(dummy).toBe(undefined)
    value.foo = 1
    expect(dummy).toBe(1)
  })

  it('should work when chained', () => {
    const value = draft({ foo: 0 })
    const c1 = view(() => value.foo)
    const c2 = view(() => c1.value + 1)
    expect(c2.value).toBe(1)
    expect(c1.value).toBe(0)
    value.foo++
    expect(c2.value).toBe(2)
    expect(c1.value).toBe(1)
  })

  it('should trigger effect when chained', () => {
    const value = draft({ foo: 0 })
    const getter1 = jest.fn(() => value.foo)
    const getter2 = jest.fn(() => {
      return c1.value + 1
    })
    const c1 = view(getter1)
    const c2 = view(getter2)

    let dummy
    effect(() => {
      dummy = c2.value
    })
    expect(dummy).toBe(1)
    expect(getter1).toHaveBeenCalledTimes(1)
    expect(getter2).toHaveBeenCalledTimes(1)
    value.foo++
    expect(dummy).toBe(2)
    // should not result in duplicate calls
    expect(getter1).toHaveBeenCalledTimes(2)
    expect(getter2).toHaveBeenCalledTimes(2)
  })

  it('should trigger effect when chained (mixed invocations)', () => {
    const value = draft({ foo: 0 })
    const getter1 = jest.fn(() => value.foo)
    const getter2 = jest.fn(() => {
      return c1.value + 1
    })
    const c1 = view(getter1)
    const c2 = view(getter2)

    let dummy
    effect(() => {
      dummy = c1.value + c2.value
    })
    expect(dummy).toBe(1)

    expect(getter1).toHaveBeenCalledTimes(1)
    expect(getter2).toHaveBeenCalledTimes(1)
    value.foo++
    expect(dummy).toBe(3)
    // should not result in duplicate calls
    expect(getter1).toHaveBeenCalledTimes(2)
    expect(getter2).toHaveBeenCalledTimes(2)
  })

  it('should no longer update when stopped', () => {
    const value = draft<{ foo?: number }>({})
    const cValue = view(() => value.foo)
    let dummy
    effect(() => {
      dummy = cValue.value
    })
    expect(dummy).toBe(undefined)
    value.foo = 1
    expect(dummy).toBe(1)
    cValue.effect.stop()
    value.foo = 2
    expect(dummy).toBe(1)
  })

  it('should invalidate before non-computed effects', () => {
    let plusOneValues: number[] = []
    const value = draft({ foo: 0 })
    const plusOne = view(() => value.foo + 1)
    effect(() => {
      value.foo
      plusOneValues.push(plusOne.value)
    })
    // access plusOne, causing it to be non-dirty
    plusOne.value
    // mutate n
    value.foo++
    // on the 2nd run, plusOne.value should have already updated.
    expect(plusOneValues).toMatchObject([1, 2, 2])
  })

  it('should expose value when stopped', () => {
    const x = view(() => 1)
    x.effect.stop()
    expect(x.value).toBe(1)
  })
})
