import { defineModel, modelManager } from '../index'
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

describe('defineModel/views', () => {
  it('should throw if changed state in a view', () => {
    let initState = {
      a: 0,
    }
    const model = defineModel({
      name: 'model',
      state: initState,
      views: {
        view() {
          this.a = 1
          return this.$state
        },
      },
    })
    const store = modelMgr.getModel(model)
    expect(() => store.view).toThrow()
    expect('Cannot change state in view function').toHaveBeenWarned()
  })

  it('should warn when return "this" or "this.$state"', () => {
    const model = defineModel({
      name: 'modal',
      state: {
        a: {},
      },
      views: {
        This() {
          return this
        },
        state() {
          return this.$state
        },
      },
    })

    const modelStore = modelMgr.getModel(model)

    void modelStore.This
    expect(
      `detect returning "this" in view, it would cause unpected behavior`
    ).toHaveBeenWarned()
    void modelStore.state
    expect(
      `detect returning "this.$state" in view, it would cause unpected behavior`
    ).toHaveBeenWarned()
  })

  it('should return same reference if no update', () => {
    const sample = defineModel({
      name: 'sample',
      state: {
        a: { foo: 'bar' },
        b: 1,
      },
      actions: {
        changeB() {
          this.b += 1
        },
      },
      views: {
        viewA() {
          void this.a
          return {}
        },
      },
    })
    const store = modelMgr.getModel(sample)

    const value = store.viewA
    store.changeB()
    expect(store.viewA).toBe(value)
  })

  it('should always return same reference if no depends', () => {
    const sample = defineModel({
      name: 'sample',
      state: {
        a: { foo: 'bar' },
        b: 1,
      },
      actions: {
        changeA() {
          this.a = { foo: 'foo' }
        },
        changeB() {
          this.b += 1
        },
      },
      views: {
        test() {
          return {}
        },
      },
    })
    const store = modelMgr.getModel(sample)

    const value = store.test
    store.changeB()
    store.changeA()
    expect(store.test).toBe(value)
    // $state still init state
    expect(store.test).toBe(value)
  })

  it("should not be invoked when deps don't change", () => {
    let calltime = 0
    const sample = defineModel({
      name: 'sample',
      state: {
        a: 0,
        b: 1,
      },
      actions: {
        changeA() {
          this.a += 1
        },
      },
      views: {
        doubleB() {
          calltime++
          return this.b * 2
        },
      },
    })
    const store = modelMgr.getModel(sample)

    expect(calltime).toBe(0)
    store.doubleB
    expect(calltime).toBe(1)
    store.changeA()
    store.doubleB
    expect(calltime).toBe(1)
  })

  it("should not be invoked when deps don't change (complex)", () => {
    let sampleComputeTimes = 0
    const sample = defineModel({
      name: 'sample',
      state: {
        value: 0,
        value1: {
          a: {
            b: 'b',
          },
        },
      },
      actions: {
        change() {
          this.value = 1
        },
      },
      views: {
        sampleView() {
          const value1 = this.value1
          sampleComputeTimes++
          const a = value1.a
          return a.b
        },
      },
    })
    const store = modelMgr.getModel(sample)

    expect(sampleComputeTimes).toBe(0)
    store.sampleView
    expect(sampleComputeTimes).toBe(1)
    store.change()
    store.sampleView
    expect(sampleComputeTimes).toBe(1)
  })

  it("should not be invoked when deps don't change (nested views)", () => {
    let selfViewComputeTimes = 0
    const selfView = defineModel({
      name: 'selfView',
      state: {
        value: 0,
        value1: {
          a: {
            b: 'b',
          },
        },
      },
      actions: {
        change() {
          this.value = 1
        },
      },
      views: {
        selfView() {
          const value1 = this.value1
          selfViewComputeTimes++
          return value1.a
        },
        objView() {
          return this.selfView
        },
      },
    })
    const store = modelMgr.getModel(selfView)

    expect(selfViewComputeTimes).toBe(0)

    store.objView
    expect(selfViewComputeTimes).toBe(1)
    store.change()
    store.objView
    expect(selfViewComputeTimes).toBe(1)
  })

  it("should not be invoked when deps don't change (this.$state())", () => {
    let calltime = 0
    const model = defineModel({
      name: 'model',
      state: {
        foo: 'bar',
      },
      actions: {
        changeValue() {
          this.foo = 'zoo'
        },
      },
      views: {
        getFoo() {
          calltime++
          return this.$state.foo
        },
      },
    })

    const store = modelMgr.getModel(model)
    expect(calltime).toBe(0)
    store.getFoo
    store.getFoo
    expect(calltime).toBe(1)

    store.changeValue()
    store.getFoo
    expect(calltime).toBe(2)
  })

  it('should return last value', () => {
    let calltimeA = 0
    let calltimeB = 0
    let calltimeC = 0
    const sample = defineModel({
      name: 'sample',
      state: {
        a: 0,
        b: {},
        c: {
          foo: 'bar',
        },
      },
      actions: {
        changeA(newValue: number) {
          this.a = newValue
        },
        changeB(newValue: any) {
          this.b = newValue
        },
        changeC(newValue: string) {
          this.c.foo = newValue
        },
      },
      views: {
        viewA() {
          calltimeA++
          return this.a
        },
        viewB() {
          calltimeB++
          return this.b
        },
        viewC() {
          calltimeC++
          return this.c
        },
      },
    })
    const store = modelMgr.getModel(sample)

    expect(calltimeC).toBe(0)
    const originC = store.viewC
    expect(calltimeC).toBe(1)

    store.changeA(10)
    expect(calltimeA).toBe(0)
    expect(store.viewA).toBe(10)
    expect(store.viewA).toBe(10)
    expect(calltimeA).toBe(1)
    let newB = {}
    store.changeB(newB)
    expect(calltimeB).toBe(0)
    expect(store.viewB).toStrictEqual(newB)
    expect(store.viewB).toStrictEqual(newB)
    expect(calltimeB).toBe(1)
    store.changeC('zoo')
    void store.viewC

    expect(store.viewC).not.toBe(originC)
    expect(store.viewC.foo).toBe('zoo')
    expect(store.viewC.foo).toBe('zoo')
    expect(calltimeC).toBe(1)
  })

  it('should return last value (replace state)', () => {
    let initState = {
      a: 0,
    }
    const model = defineModel({
      name: 'model',
      state: initState,
      actions: {
        replace(newState: any) {
          this.$state = newState
        },
      },
      views: {
        view() {
          return this.$state.a
        },
      },
    })
    const store = modelMgr.getModel(model)
    expect(store.view).toStrictEqual(0)
    const newState = { a: 2 }
    store.replace(newState)
    expect(store.view).toStrictEqual(newState.a)
  })

  it('should return last value (non-existed property)', () => {
    const fn = jest.fn()
    let initState = {}
    const model = defineModel({
      name: 'model',
      state: initState as { a: number },
      views: {
        view() {
          fn()
          return this.a
        },
      },
    })
    const store = modelMgr.getModel(model)
    expect(fn).toHaveBeenCalledTimes(0)

    expect(store.view).toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(1)

    store.$patch({ a: 1 })
    // re-run view
    expect(store.view).toStrictEqual(1)
    // cache view
    expect(store.view).toStrictEqual(1)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should return last value (using this.$state in view)', () => {
    let numberOfCalls = 0
    const test = defineModel({
      name: 'test',
      state: {
        other: 'other value',
        level1: {
          level2: 'initial',
        },
      },
      actions: {
        changeOther(value: string) {
          this.other = value
        },
      },
      views: {
        getOther() {
          numberOfCalls++
          return this.$state.other
        },
        getLevel1() {
          numberOfCalls++
          const value = this.$state.level1
          return value
        },
        getLevel2() {
          numberOfCalls++
          return this.$state.level1.level2
        },
      },
    })

    const store = modelMgr.getModel(test)

    expect(numberOfCalls).toBe(0)
    store.getOther
    expect(numberOfCalls).toBe(1)

    const level1 = store.getLevel1
    expect(numberOfCalls).toBe(2)

    const level2 = store.getLevel2
    expect(numberOfCalls).toBe(3)

    store.changeOther('modify other value')
    expect(numberOfCalls).toBe(3)
    expect(store.$state.other).toEqual('modify other value')
    expect(store.getOther).toEqual('modify other value')
    expect(numberOfCalls).toBe(4)

    expect(store.getLevel1).toBe(level1)
    expect(numberOfCalls).toBe(4)

    expect(store.getLevel2).toBe(level2)
    expect(numberOfCalls).toBe(4)
  })

  describe('view with depends', () => {
    it('should not be invoked if no dep update', () => {
      const modelA = defineModel({
        name: 'modelA',
        state: {
          a: 0,
          b: 1,
        },
        actions: {
          changeB() {
            this.b += 1
          },
        },
      })
      let calltime = 0
      const sample = defineModel(
        {
          name: 'sample',
          state: {},
          views: {
            viewA() {
              calltime++
              return this.$dep.modelA.a
            },
          },
        },
        [modelA]
      )
      const store = modelMgr.getModel(sample)

      expect(calltime).toBe(0)
      store.viewA
      expect(calltime).toBe(1)
      modelMgr.getModel(modelA).changeB()
      store.viewA
      expect(calltime).toBe(1)
    })

    it('should return last state', () => {
      const modelA = defineModel({
        name: 'modelA',
        state: {
          a: 0,
        },
        actions: {
          changeA() {
            this.a += 1
          },
        },
        views: {
          doubleA() {
            return this.a * 2
          },
        },
      })
      const sample = defineModel(
        {
          name: 'sample',
          state: {},
          views: {
            viewA() {
              return this.$dep.modelA.doubleA
            },
          },
        },
        [modelA]
      )
      const store = modelMgr.getModel(sample)
      const storeA = modelMgr.getModel(modelA)
      expect(store.viewA).toBe(0)
      storeA.changeA()
      expect(storeA.doubleA).toBe(2)
      expect(store.viewA).toBe(2)
    })
  })

  describe('primitive state/simple value', () => {
    it("should not be invoked when deps don't change", () => {
      let numberOfCalls = 0
      const numberModel = defineModel({
        name: 'numberModel',
        state: 0,
        actions: {
          doNothing: () => {},
        },
        views: {
          double() {
            numberOfCalls++
            return this.$state * 2
          },
        },
      })

      const numberStore = modelMgr.getModel(numberModel)

      expect(numberOfCalls).toBe(0)
      expect(numberStore.double).toBe(0)
      expect(numberOfCalls).toBe(1)

      numberStore.doNothing()
      expect(numberStore.double).toBe(0)
      expect(numberOfCalls).toBe(1)
    })

    it('should return last value', () => {
      let numberOfCalls = 0
      const numberModel = defineModel({
        name: 'numberModel',
        state: 0,
        actions: {
          increment() {
            this.$state += 1
          },
        },
        views: {
          double() {
            numberOfCalls++
            return this.$state * 2
          },
        },
      })

      const numberStore = modelMgr.getModel(numberModel)

      expect(numberOfCalls).toBe(0)
      expect(numberStore.double).toBe(0)
      expect(numberOfCalls).toBe(1)

      numberStore.increment()
      expect(numberStore.double).toBe(2)
      expect(numberOfCalls).toBe(2)
    })
  })

  it('should return new reference when target is modified', async () => {
    const model = defineModel({
      name: 'model',
      state: {
        numbers: [1, 2],
      },
      actions: {
        add(n: number) {
          this.numbers.push(n)
        },
      },
      views: {
        nums() {
          return this.numbers
        },
      },
    })

    const store = modelMgr.getModel(model)

    let value = store.nums
    expect(value).toEqual([1, 2])
    store.add(3)
    await nextTick()
    // expect(store.nums).not.toBe(value)
    expect(store.nums).toEqual([1, 2, 3])
    store.add(4)
    await nextTick()
    expect(store.nums).toEqual([1, 2, 3, 4])
  })

  describe('array', () => {
    it('should return new reference when element is modified', async () => {
      const model = defineModel({
        state: {
          todos: [{ id: 0, finished: false }],
          nextId: 0,
        },
        actions: {
          toggle(id: number) {
            const todo = this.todos.find((i) => i.id === id)
            if (todo) {
              todo.finished = !todo.finished
            }
          },
        },
        views: {
          allTodos() {
            return this.todos
          },
        },
      })

      const store = modelMgr.getModel(model)

      let value = store.allTodos
      expect(value).toEqual([{ id: 0, finished: false }])

      store.toggle(0)
      await nextTick()
      expect(store.allTodos).not.toEqual(value)
      expect(store.allTodos).toEqual([{ id: 0, finished: true }])
    })
  })

  describe('primitive state/array', () => {
    it("should not be invoked when deps don't change", () => {
      let numberOfCalls = 0

      const arrayModel = defineModel({
        name: 'arrayModel',
        state: [0, 1],
        actions: {
          doNothing: () => {},
        },
        views: {
          double() {
            numberOfCalls++
            return this.$state.map((a) => a * 2)
          },
        },
      })

      const arrayStore = modelMgr.getModel(arrayModel)

      expect(numberOfCalls).toBe(0)
      expect(arrayStore.double).toEqual([0, 2])
      expect(numberOfCalls).toBe(1)

      arrayStore.doNothing()
      expect(arrayStore.double).toEqual([0, 2])
      expect(numberOfCalls).toBe(1)
    })

    it('should return last value', () => {
      let numberOfCalls = 0

      const arrayModel = defineModel({
        name: 'arrayModel',
        state: [0],
        actions: {
          remove(payload: number) {
            this.$state.splice(payload, 1)
          },
          append(payload: any) {
            this.$state.push(payload)
          },
        },
        views: {
          double() {
            numberOfCalls++
            return this.$state.map((a) => a * 2)
          },
        },
      })

      const arrayStore = modelMgr.getModel(arrayModel)

      expect(numberOfCalls).toBe(0)
      expect(arrayStore.double).toEqual([0])
      expect(numberOfCalls).toBe(1)

      arrayStore.append(1)
      expect(arrayStore.double).toEqual([0, 2])
      expect(numberOfCalls).toBe(2)
    })
  })
})
