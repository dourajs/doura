import { AnyObjectModel } from '../modelOptions'
import { ModelInternal, ActionType, ModelInternalOptions } from '../model'
import { nextTick } from '../scheduler'

let oldEnv: any
beforeAll(() => {
  oldEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
})
afterAll(() => {
  process.env.NODE_ENV = oldEnv
})

const createModel = (
  model: AnyObjectModel,
  options: ModelInternalOptions = {}
) => new ModelInternal(model, options)

export const sleep = (time: number) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, time)
  })

describe('model', () => {
  test('getState should return raw state', () => {
    const originState = {
      arr: [1, 2],
    }
    const model = createModel({
      state: originState,
      views: {
        firstOfArr() {
          return this.arr[0]
        },
      },
    })

    const state = model.getState() as any
    expect(state).toBe(originState)
  })

  test('getApi should return raw state and views', async () => {
    const originState = {
      a: 1,
      arr: [1, 2],
    }
    const model = createModel({
      state: originState,
      actions: {
        updateA(newV: number) {
          this.a = newV
        },
      },
      views: {
        firstOfArr() {
          return this.arr[0]
        },
      },
    })

    const api1 = model.getApi() as any
    expect(api1).toEqual({
      a: 1,
      arr: [1, 2],
      firstOfArr: 1,
    })
    expect(api1.arr).toBe(originState.arr)
    ;(model.proxy as any).updateA(2)
    await nextTick()
    const api2 = model.getApi()
    expect(api2).not.toBe(api1)
    expect(api2).toEqual({
      a: 2,
      arr: [1, 2],
      firstOfArr: 1,
    })
  })

  describe('isolate', () => {
    it('should not track reactive values in isolate()', () => {
      const model = createModel({
        state: { anObj: { a: 0 }, value: 0 },
        views: {
          view() {
            const anObj = this.anObj
            return {
              anObj,
              value: this.value,
            }
          },
          isolatedView() {
            const anObj = this.$isolate((s: any) => s.anObj)
            return {
              anObj,
              value: this.value,
            }
          },
        },
        actions: {
          update() {
            this.anObj.a++
          },
        },
      }).proxy as any
      let value = model.view
      let isolatedValue = model.isolatedView
      expect(value).toEqual({ anObj: { a: 0 }, value: 0 })
      expect(isolatedValue).toEqual({ anObj: { a: 0 }, value: 0 })
      model.update()
      let nextValue = model.view
      let nextIsolatedValue = model.isolatedView
      expect(nextValue).not.toBe(value)
      expect(nextValue).toEqual({ anObj: { a: 1 }, value: 0 })
      expect(nextIsolatedValue).toBe(isolatedValue)
      expect(nextIsolatedValue).toEqual({ anObj: { a: 0 }, value: 0 })
    })
  })

  describe('subscribe()', () => {
    it('should work', async () => {
      type IState = {
        a: number
        b: number
      }
      const count = createModel({
        state: { a: 1, b: 1 } as IState,
      })

      const onChange = jest.fn()
      count.subscribe(onChange)
      count.patch({ a: 2 })
      expect(count.stateRef.value).toEqual({ a: 2, b: 1 })
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0][0]).toMatchObject({
        type: ActionType.PATCH,
        patch: { a: 2 },
      })

      count.replace({ a: 3, b: 3 })
      expect(count.stateRef.value).toEqual({ a: 3, b: 3 })
      expect(onChange).toHaveBeenCalledTimes(2)
      expect(onChange.mock.calls[1][0]).toMatchObject({
        type: ActionType.REPLACE,
      })

      count.stateRef.value.a = 4
      await nextTick()
      expect(onChange).toHaveBeenCalledTimes(3)
      expect(onChange.mock.calls[2][0]).toMatchObject({
        type: ActionType.MODIFY,
      })
    })
  })

  describe('patch()', () => {
    it('should warn primitive value', () => {
      const count = createModel({
        state: 1,
      })

      // @ts-expect-error patch argument should be an object
      count.patch(2)
      expect('patch argument should be an object').toHaveBeenWarned()
    })

    it('should patch the state', () => {
      type IState = {
        a: number
        b: number
      }
      const count = createModel({
        state: { a: 1, b: 1 } as IState,
      })

      const onChange = jest.fn()
      count.subscribe(onChange)
      count.patch({ a: 2 })
      expect(count.stateRef.value).toEqual({ a: 2, b: 1 })
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0][0]).toMatchObject({
        type: ActionType.PATCH,
      })

      count.patch({ b: 2 })
      expect(count.stateRef.value).toEqual({ a: 2, b: 2 })
      expect(onChange).toHaveBeenCalledTimes(2)
      expect(onChange.mock.calls[1][0]).toMatchObject({
        type: ActionType.PATCH,
      })
    })

    it('should patch deep state', () => {
      const count = createModel({
        state: {
          a: {
            b: 'b',
            c: 'c',
            d: {
              f: 'f',
            },
          },
        },
      })

      count.patch({
        a: {
          m: 'n',
          c: 'c1',
          d: {
            f: 'f1',
            o: 'o',
          },
        },
      })

      expect(count.stateRef.value).toEqual({
        a: {
          b: 'b',
          c: 'c1',
          d: {
            f: 'f1',
            o: 'o',
          },
          m: 'n',
        },
      })
    })
  })

  describe('createView()', () => {
    it('should work', () => {
      const viewGetter = jest.fn(function (this: any) {
        return this.a
      })
      const model = createModel({
        state: {
          a: 1,
        },
        actions: {
          add(n: number = 1) {
            this.a += n
          },
        },
      })

      const view = model.createView(viewGetter)

      expect(viewGetter).toHaveBeenCalledTimes(0)
      expect(view.value).toEqual(1)
      expect(viewGetter).toHaveBeenCalledTimes(1)
      ;(model.proxy as any).add()
      expect(view.value).toEqual(2)
      expect(viewGetter).toHaveBeenCalledTimes(2)
      expect(viewGetter).toHaveBeenCalledTimes(2)
    })

    it('should access actions from the first parameter', () => {
      const viewGetter = jest.fn(function (this: any) {
        return { a: this.a, add: this.add }
      })
      const model = createModel({
        state: {
          a: 1,
        },
        actions: {
          add(n: number = 1) {
            this.a += n
          },
        },
      })

      const res = model.createView(viewGetter)

      expect(viewGetter).toHaveBeenCalledTimes(0)
      expect(res.value.a).toEqual(1)
      expect(viewGetter).toHaveBeenCalledTimes(1)
      res.value.add()
      expect(res.value.a).toEqual(2)
      expect(viewGetter).toHaveBeenCalledTimes(2)
      expect(viewGetter).toHaveBeenCalledTimes(2)
    })
  })

  describe('depend() cleanup on child destroy', () => {
    test('should remove stale handler from parent when child is destroyed', () => {
      const parent = createModel({
        state: { value: 1 },
        actions: {
          inc() {
            this.value += 1
          },
        },
      })
      const child = createModel({
        state: { count: 0 },
        actions: {
          bump() {
            this.count += 1
          },
        },
      })

      parent.depend(child)
      expect((parent as any)._depListenersHandlers.length).toBe(1)

      child.destroy()

      // After child destroy, parent's stale dep handler should be cleaned up
      expect((parent as any)._depListenersHandlers.length).toBe(0)
    })

    test('should only remove handler for destroyed child, keep others', () => {
      const parent = createModel({ state: { value: 1 } })
      const childA = createModel({
        state: { a: 1 },
        actions: {
          bump() {
            this.a += 1
          },
        },
      })
      const childB = createModel({
        state: { b: 1 },
        actions: {
          bump() {
            this.b += 1
          },
        },
      })

      parent.depend(childA)
      parent.depend(childB)
      expect((parent as any)._depListenersHandlers.length).toBe(2)

      childA.destroy()

      // Only childA's handler removed
      expect((parent as any)._depListenersHandlers.length).toBe(1)
    })
  })

  describe('_lastDraftToSnapshot cache', () => {
    it('should use WeakMap so orphaned draft proxies can be GC-ed', () => {
      const model = createModel({
        state: { data: { value: 1 } },
        actions: {
          modify() {
            this.data.value += 1
          },
          replaceData(n: number) {
            this.data = { value: n }
          },
        },
      })

      const cache = (model as any)._lastDraftToSnapshot
      // Must be a WeakMap so orphaned draft proxy keys are reclaimable by GC
      expect(cache).toBeInstanceOf(WeakMap)
    })

    it('should preserve structural sharing after sub-tree replacement cycles', () => {
      const model = createModel({
        state: { data: { value: 1 }, stable: { x: 'unchanged' } },
        actions: {
          modify() {
            this.data.value += 1
          },
          replaceData(n: number) {
            this.data = { value: n }
          },
        },
      })

      // Trigger initial snapshot via modify
      ;(model.actions as any).modify()
      const stableRef1 = model.getState().stable

      // 50 cycles of modify→replace to stress the cache
      for (let i = 0; i < 50; i++) {
        ;(model.actions as any).modify()
        ;(model.actions as any).replaceData(i + 100)
      }

      // Structural sharing: unmodified 'stable' subtree should keep the same reference
      const stableRef2 = model.getState().stable
      expect(stableRef2).toBe(stableRef1)

      // Value correctness: data should reflect the last replacement
      expect(model.getState().data).toEqual({ value: 149 })
    })
  })
})
