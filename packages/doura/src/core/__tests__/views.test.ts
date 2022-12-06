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
  it('should receive state as first params', () => {
    const count = defineModel({
      state: {
        count: 1,
      },
      views: {
        double(s) {
          return s.count * 2
        },
      },
    })
    const store = modelMgr.getModel('test', count)

    expect(store.double).toBe(2)
  })

  it('should throw if changed state in a view', () => {
    let initState = {
      a: 0,
    }
    const model = defineModel({
      state: initState,
      views: {
        view() {
          this.a = 1
          return this.$state
        },
      },
    })
    const store = modelMgr.getModel('test', model)
    expect(() => store.view).toThrow()
    expect(
      'Attempting to change state "a". State are readonly in "views"'
    ).toHaveBeenWarned()
  })

  it('should warn when return "this" or "this.$state"', () => {
    const model = defineModel({
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

    const modelStore = modelMgr.getModel('test', model)

    void modelStore.This
    expect(
      `detected that "self" is returned in view, it would cause unpected behavior`
    ).toHaveBeenWarned()
    void modelStore.state
    expect(
      `detected that "$state" is returned in view, it would cause unpected behavior`
    ).toHaveBeenWarned()
  })

  it('should return same reference if no update', () => {
    const model = defineModel({
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
    const store = modelMgr.getModel('test', model)

    const value = store.viewA
    store.changeB()
    expect(store.viewA).toBe(value)
  })

  it('should always return same reference if no depends', () => {
    const model = defineModel({
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
    const store = modelMgr.getModel('test', model)

    const value = store.test
    store.changeB()
    store.changeA()
    expect(store.test).toBe(value)
    // $state still init state
    expect(store.test).toBe(value)
  })

  it("should not be invoked when deps don't change", () => {
    let calltime = 0
    const model = defineModel({
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
    const store = modelMgr.getModel('test', model)

    expect(calltime).toBe(0)
    store.doubleB
    expect(calltime).toBe(1)
    store.changeA()
    store.doubleB
    expect(calltime).toBe(1)
  })

  it("should not be invoked when deps don't change (complex)", () => {
    let sampleComputeTimes = 0
    const model = defineModel({
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
    const store = modelMgr.getModel('test', model)

    expect(sampleComputeTimes).toBe(0)
    store.sampleView
    expect(sampleComputeTimes).toBe(1)
    store.change()
    store.sampleView
    expect(sampleComputeTimes).toBe(1)
  })

  it("should not be invoked when deps don't change (nested views)", () => {
    let selfViewComputeTimes = 0
    const model = defineModel({
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
    const store = modelMgr.getModel('test', model)

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

    const store = modelMgr.getModel('test', model)
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
    const model = defineModel({
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
    const store = modelMgr.getModel('test', model)

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

    // a.viewA
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
    const store = modelMgr.getModel('test', model)
    expect(store.view).toStrictEqual(0)
    const newState = { a: 2 }
    store.replace(newState)
    expect(store.view).toStrictEqual(newState.a)
  })

  it('should return last value (using this.$state in view)', () => {
    let numberOfCalls = 0
    const model = defineModel({
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

    const store = modelMgr.getModel('test', model)

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

  it('should not reactive to properties not existing in the initial state', () => {
    const fn = jest.fn()
    let initState = {}
    const model = defineModel({
      state: initState as { a: number },
      views: {
        view() {
          fn()
          return this.a
        },
      },
    })
    const store = modelMgr.getModel('test', model)
    expect(fn).toHaveBeenCalledTimes(0)

    expect(store.view).toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(1)

    store.$patch({ a: 1 })
    // should not re-run view
    expect(store.view).toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  describe('view with depends', () => {
    it('should not be invoked if no dep update', () => {
      const modelA = defineModel({
        state: {
          value: 0,
        },
        actions: {
          inc() {
            this.value += 1
          },
        },
      })
      let calltime = 0
      const model = defineModel(({ use }) => {
        const a = use(modelA)

        return {
          state: {},
          views: {
            viewA() {
              calltime++
              return a.value
            },
          },
        }
      })
      const store = modelMgr.getModel('test', model)

      expect(calltime).toBe(0)
      store.viewA
      expect(calltime).toBe(1)
      modelMgr.getModel('a', modelA).inc()
      store.viewA
      expect(calltime).toBe(1)
    })

    it('should return last state', () => {
      const modelA = defineModel({
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
      const model = defineModel(({ use }) => {
        const a = use('a', modelA)
        return {
          state: {},
          views: {
            viewA() {
              return a.doubleA
            },
          },
        }
      })
      const store = modelMgr.getModel('test', model)
      const storeA = modelMgr.getModel('a', modelA)
      expect(store.viewA).toBe(0)
      storeA.changeA()
      expect(storeA.doubleA).toBe(2)
      expect(store.viewA).toBe(2)
    })
  })

  describe('array', () => {
    it('should return a new array when it is modified', async () => {
      const model = defineModel({
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

      const store = modelMgr.getModel('test', model)

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

    it('should return a new array when an existing element is modified', async () => {
      const todo = defineModel({
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

      const store = modelMgr.getModel('todo', todo)

      let value = store.allTodos
      expect(value).toEqual([{ id: 0, finished: false }])

      store.toggle(0)
      await nextTick()
      expect(store.allTodos).not.toEqual(value)
      expect(store.allTodos).toEqual([{ id: 0, finished: true }])
    })

    it('should return a new array when a new element is modified', async () => {
      const todo = defineModel({
        state: {
          todos: [] as { id: number; finished: boolean }[],
          nextId: 0,
        },
        actions: {
          addTodo() {
            this.todos.push({
              id: this.nextId++,
              finished: false,
            })
          },
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

      const store = modelMgr.getModel('todo', todo)

      expect(store.allTodos).toEqual([])
      store.addTodo()
      await nextTick()

      let value = store.allTodos
      expect(value).toEqual([{ id: 0, finished: false }])
      expect(store.allTodos).toEqual([{ id: 0, finished: false }])

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

      const arrayStore = modelMgr.getModel('array', arrayModel)

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

      const arrayStore = modelMgr.getModel('array', arrayModel)

      expect(numberOfCalls).toBe(0)
      expect(arrayStore.double).toEqual([0])
      expect(numberOfCalls).toBe(1)

      arrayStore.append(1)
      expect(arrayStore.double).toEqual([0, 2])
      expect(numberOfCalls).toBe(2)
    })
  })
})
