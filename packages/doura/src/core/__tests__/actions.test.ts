import { ActionType, defineModel, modelManager } from '../index'
import { nextTick } from '../scheduler'

let modelMgr: ReturnType<typeof modelManager>
beforeEach(() => {
  modelMgr = modelManager()
})

let oldEnv: any
beforeAll(() => {
  oldEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
})
afterAll(() => {
  process.env.NODE_ENV = oldEnv
})

const timeout = (n: number = 0) => new Promise((r) => setTimeout(r, n))

describe('defineModel/actions', () => {
  it('should change the state', () => {
    const count = defineModel({
      name: 'count',
      state: { value: 0 },
      actions: {
        add() {
          this.value += 1
        },
      },
    })

    const store = modelMgr.getModel(count)
    expect(typeof store.add).toBe('function')

    store.add()
    expect(store.$state).toEqual({ value: 1 })

    store.add()
    expect(store.$state).toEqual({ value: 2 })
  })

  it('should accept params', () => {
    const model = defineModel({
      name: 'model',
      state: { values: [] } as any,
      actions: {
        push(...values: any[]) {
          this.values.push(...values)
        },
      },
    })

    const store = modelMgr.getModel(model)

    store.push(1)
    expect(store.$state.values).toEqual([1])

    store.push(2, 3)
    expect(store.$state.values).toEqual([1, 2, 3])
  })

  it('should return value', () => {
    const model = defineModel({
      name: 'model',
      state: { values: null },
      actions: {
        set() {
          return 'result'
        },
      },
    })

    const store = modelMgr.getModel(model)
    expect(store.set()).toBe('result')
  })

  it('should support async actions', async () => {
    const example = defineModel({
      name: 'example',
      state: { value: 0 },
      actions: {
        async asyncAction(): Promise<void> {
          this.value += 1
          await timeout(1000)
          this.value += 1
        },
      },
    })

    const store = modelMgr.getModel(example)

    store.asyncAction()
    expect(store.$state.value).toBe(1)
    await timeout(1000)
    expect(store.$state.value).toBe(2)
  })

  it('shouldb batch update and only triggered once', async () => {
    const fn = jest.fn()
    const count = defineModel({
      name: 'count',
      state: { value: 0 },
      actions: {
        add() {
          this.value += 1
          this.value += 1
        },
      },
    })

    const store = modelMgr.getModel(count)
    modelMgr.subscribe(count, fn)
    store.add()
    expect(fn).toHaveBeenCalledTimes(0)
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(store.$state).toEqual({ value: 2 })
  })

  it('shouldb batch update and only triggered once (async action)', async () => {
    const fn = jest.fn()
    const count = defineModel({
      name: 'count',
      state: { value: 0 },
      actions: {
        async add() {
          this.value += 1
          this.value += 1
          await timeout(10)
          this.value += 1
          this.value += 1
        },
      },
    })

    const store = modelMgr.getModel(count)
    modelMgr.subscribe(count, fn)
    store.add()
    expect(fn).toHaveBeenCalledTimes(0)
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(store.$state).toEqual({ value: 2 })
    await timeout(10)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(store.$state).toEqual({ value: 4 })
  })

  it('shouldb batch update and only triggered once (async action)', async () => {
    const fn = jest.fn()
    const count = defineModel({
      name: 'count',
      state: { value: 0 },
      actions: {
        async add() {
          this.value += 1
          this.value += 1
          await timeout(10)
          this.value += 1
          this.value += 1
        },
      },
    })

    const store = modelMgr.getModel(count)
    modelMgr.subscribe(count, fn)
    store.add()
    expect(fn).toHaveBeenCalledTimes(0)
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(store.$state).toEqual({ value: 2 })
    await timeout(10)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(store.$state).toEqual({ value: 4 })
  })

  it('should return original object if it has not been modified', async () => {
    const state = {
      anObj: {
        a: 'a',
        aNestObj: {
          b: 'b',
        },
      },
      anArr: [1],
      c: 0,
    }
    const count = defineModel({
      name: 'count',
      state: state,
      actions: {
        async change() {
          this.c = 1
        },
      },
    })

    const store = modelMgr.getModel(count)
    store.change()
    await nextTick()
    expect(store.$rawState).toEqual({
      anObj: {
        a: 'a',
        aNestObj: {
          b: 'b',
        },
      },
      anArr: [1],
      c: 1,
    })
    expect(store.$rawState.anObj).toBe(state.anObj)
    expect(store.$rawState.anObj.aNestObj).toBe(state.anObj.aNestObj)
    expect(store.$rawState.anArr).toBe(state.anArr)
  })

  it('should return a new object if the original one get modified', async () => {
    const state = {
      anObj: {
        a: 'a',
        aNestObj: {
          b: 'b',
        },
      },
      anArr: [1],
    }
    const count = defineModel({
      name: 'count',
      state: state,
      actions: {
        async change() {
          this.anObj.aNestObj.b = 'bb'
          this.anArr.push(2)
        },
      },
    })

    const store = modelMgr.getModel(count)
    store.change()
    await nextTick()
    expect(store.$rawState).toEqual({
      anObj: {
        a: 'a',
        aNestObj: {
          b: 'bb',
        },
      },
      anArr: [1, 2],
    })
    expect(store.$rawState.anObj).not.toBe(state.anObj)
    expect(store.$rawState.anObj.aNestObj).not.toBe(state.anObj.aNestObj)
    expect(store.$rawState.anArr).not.toBe(state.anArr)
  })

  it('should access views by `this`', () => {
    const example = defineModel({
      name: 'example',
      state: { value: 0 },
      actions: {
        set(n: number) {
          this.value = n
        },
      },
      views: {
        valuePlusN() {
          return this.value + 1
        },
      },
    })

    const store = modelMgr.getModel(example)

    store.set(5)
    expect(store.valuePlusN).toBe(6)
  })

  describe('this.$state', () => {
    it('should change value by $state', () => {
      const model = defineModel({
        name: 'model',
        state: { value: 1 },
        actions: {
          add(n: number) {
            this.$state.value += n
          },
        },
      })

      const store = modelMgr.getModel(model)

      store.add(9)
      expect(store.$state.value).toBe(10)
    })

    it('should always return the newest state', () => {
      const state: number[] = []
      const count = defineModel({
        name: 'count',
        state: { value: 0 },
        actions: {
          plusOne() {
            this.value += 1
          },
          makeCall(_: number): void {
            this.plusOne()
            state.push(this.$state.value)
            this.plusOne()
            state.push(this.$state.value)
          },
        },
      })

      const store = modelMgr.getModel(count)

      store.makeCall(2)
      expect(state).toEqual([1, 2])
    })

    // todo: fixme
    it.skip('should throw error if changed state not by reducer in development', async () => {
      const count = defineModel({
        name: 'count',
        state: { value: 0 },
      })

      const store = modelMgr.getModel(count)

      const state = store.$state
      state.value = 1

      expect(
        'Set operation on key "value" failed: target is readonly.'
      ).toHaveBeenWarned()
    })

    it('should replace state by assgining to this.$state', () => {
      const count = defineModel({
        name: 'count',
        state: { a: 1, b: 1 },
        actions: {
          replace(newState: any): void {
            this.$state = newState
          },
        },
      })

      const store = modelMgr.getModel(count)

      const newState1 = {
        a: 2,
      }
      store.replace(newState1)
      expect(store.$state).toEqual(newState1)

      store.replace(2)
      expect(store.$state).toEqual(2)
    })

    it('should error when assign Symbol or BigInt to this.$state', () => {
      const anyModal = defineModel({
        name: 'anyModal',
        state: { value: 0 },
        actions: {
          replace(value: any): void {
            this.$state = value
          },
        },
      })

      const store = modelMgr.getModel(anyModal)
      expect(store.$state).toEqual({ value: 0 })

      expect(() => store.replace(Symbol('foo') as any)).toThrow()
      expect(() => store.replace(BigInt(1111) as any)).toThrow()
      expect(
        "[Doura warn] 'BigInt' and 'Symbol' are not assignable to the State"
      ).toHaveBeenWarnedTimes(2)
    })
  })
})
