import { AnyModel } from '../modelOptions'
import { ModelInternal, ActionType } from '../model'
import { nextTick } from '../scheduler'

let oldEnv: any
beforeAll(() => {
  oldEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
})
afterAll(() => {
  process.env.NODE_ENV = oldEnv
})

const createModel = (options: AnyModel, initState?: any) =>
  new ModelInternal(options, initState)

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

  describe('subscribe()', () => {
    it('should work', async () => {
      type IState = {
        a: number
        b: number
      }
      const count = createModel({
        name: 'count',
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
        name: 'count',
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
        name: 'count',
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
        name: 'count',
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
        name: 'model',
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
