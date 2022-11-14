import { AnyModel } from '../modelOptions'
import { ModelInternal } from '../model'
import { nextTick } from '../scheduler'

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
