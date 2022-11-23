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

  test('getSnapshot should return raw state and views', async () => {
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

    const snapshot = model.getSnapshot() as any
    expect(snapshot).toEqual({
      $state: {
        a: 1,
        arr: [1, 2],
      },
      a: 1,
      arr: [1, 2],
      firstOfArr: 1,
    })
    expect(snapshot.arr).toBe(originState.arr)
    ;(model.proxy as any).updateA(2)
    await nextTick()
    expect(model.getSnapshot()).toEqual({
      $state: {
        a: 2,
        arr: [1, 2],
      },
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

      // @ts-expect-error
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

  describe('createView', () => {
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
  })
})
