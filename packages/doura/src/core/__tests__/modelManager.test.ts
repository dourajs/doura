import { defineModel, modelManager, Plugin } from '../index'
import { nextTick } from '../scheduler'

describe('modelManager', () => {
  it('always return a new instance', () => {
    const modelMgrA = modelManager()
    const modelMgrB = modelManager()
    expect(modelMgrA).not.toBe(modelMgrB)
  })

  it('should have the proper api', () => {
    const modelMgr = modelManager()
    const model = defineModel({
      state: { value: 0 },
      actions: {
        actionOne() {},
      },
      views: {
        viewOne() {},
      },
    })

    const store = modelMgr.getModel('test', model)
    expect(typeof store.$state).toBe('object')
    expect(typeof store.$actions).toBe('object')
    expect(typeof store.$views).toBe('object')
    expect(typeof store.$patch).toBe('function')
    expect(typeof store.$getApi).toBe('function')
    expect(typeof store.$createView).toBe('function')
    expect(typeof store.$onAction).toBe('function')
    expect(typeof store.$subscribe).toBe('function')
    expect(typeof store.actionOne).toBe('function')
    expect(typeof store.viewOne).toBe('undefined')
  })

  it('should init store by initialStage', () => {
    const modelMgr = modelManager({
      initialState: {
        one: {
          value: 'one',
        },
        two: {
          value: 'two',
        },
      },
    })
    const modelOne = defineModel({
      state: { value: 0 },
    })
    const modelTwo = defineModel({
      state: { value: 0 },
    })
    const storeOne = modelMgr.getModel('one', modelOne)
    const storeTwo = modelMgr.getModel('two', modelTwo)
    expect(storeOne.$state.value).toBe('one')
    expect(storeTwo.$state.value).toBe('two')
  })

  it('getState should return the newest state', async () => {
    const modelMgr = modelManager()
    const count0 = defineModel({
      state: { value: 0 },
      actions: {
        increment(v: number) {
          this.value += v
        },
      },
    })
    const count1 = defineModel({
      state: { value: 0 },
      actions: {
        increment(v: number) {
          this.value += v
        },
      },
    })

    const store0 = modelMgr.getModel('count0', count0)
    const store1 = modelMgr.getModel('count1', count1)
    expect(modelMgr.getState()).toEqual({
      count0: { value: 0 },
      count1: { value: 0 },
    })
    store0.increment(1)
    store1.increment(2)
    await nextTick()
    expect(modelMgr.getState()).toEqual({
      count0: { value: 1 },
      count1: { value: 2 },
    })
  })

  it('should destroy', () => {
    const modelMgr = modelManager()
    const model = defineModel({
      state: { value: 0 },
      actions: {
        increment(v: number) {
          this.value += v
        },
      },
    })

    const store = modelMgr.getModel('test', model)
    store.increment(1)
    expect(store.$state.value).toBe(1)

    modelMgr.destroy()
    const newStore = modelMgr.getModel('test', model)
    expect(newStore).not.toBe(store)
    expect(newStore.$state.value).toBe(0)
  })

  it('should trigger change when dependencies have changed', async () => {
    let storeCount = 0
    let modelCount = 0
    let dependCount = 0
    const modelMgr = modelManager()
    modelMgr.subscribe(() => {
      storeCount++
    })

    const firstModel = defineModel({
      state: { value: 0 },
      actions: {
        addOne() {
          this.value += 1
        },
      },
    })
    const fisrt = modelMgr.getModel('first', firstModel)

    fisrt.$subscribe(() => {
      dependCount++
    })
    const secondModel = defineModel(({ use }) => {
      void use('first', firstModel)
      return {
        state: { value: 0 },
        actions: {
          add(n: number) {
            this.value += n
          },
        },
      }
    })

    const second = modelMgr.getModel('second', secondModel)
    second.$subscribe(() => {
      modelCount++
    })

    fisrt.addOne()
    await nextTick()
    expect(dependCount).toBe(1)
    expect(modelCount).toBe(1)
    expect(storeCount).toBe(1)
    fisrt.addOne()
    await nextTick()
    expect(dependCount).toBe(2)
    expect(modelCount).toBe(2)
    expect(storeCount).toBe(2)
    second.add(1)
    await nextTick()
    expect(dependCount).toBe(2)
    expect(modelCount).toBe(3)
    expect(storeCount).toBe(3)
  })

  describe('subscribe', () => {
    it('should subscribe to all models', async () => {
      const fn = jest.fn()
      const modelMgr = modelManager()
      const modelA = defineModel({
        state: { value: 0 },
        actions: {
          increment(n: number) {
            this.value += n
          },
        },
      })
      const modelB = defineModel(({ use }) => {
        const a = use(modelA)
        return {
          state: { value: 0 },
          actions: {
            increment(n: number) {
              a.increment(n)
              this.value += n
            },
          },
        }
      })

      modelMgr.subscribe(fn)
      const store = modelMgr.getModel('b', modelB)

      expect(fn).toHaveBeenCalledTimes(0)
      store.increment(1)
      expect(fn).toHaveBeenCalledTimes(0)
      await nextTick()
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('plugin', () => {
    it('should have the proper api', () => {
      const onInit = jest.fn()
      const onModel = jest.fn()
      const onModelInstance = jest.fn()
      const onDestroy = jest.fn()
      const plugin: Plugin = () => {
        return {
          onInit,
          onModel,
          onModelInstance,
          onDestroy,
        }
      }

      let initialState = {}
      const modelMgr = modelManager({
        initialState,
        plugins: [[plugin, {}]],
      })

      expect(onInit).toHaveBeenCalledWith({ initialState }, { doura: modelMgr })

      const model = defineModel({
        state: { value: '' },
      })
      modelMgr.getModel('test', model)
      expect(onModel).toHaveBeenCalledWith('test', model, { doura: modelMgr })
      expect(typeof onModelInstance.mock.calls[0][0].$name).toBe('string')
      expect(typeof onModelInstance.mock.calls[0][0].$state).toBe('object')
      expect(typeof onModelInstance.mock.calls[0][0].$subscribe).toBe(
        'function'
      )

      modelMgr.destroy()
      expect(onDestroy).toHaveBeenCalledWith()
    })
  })
})
