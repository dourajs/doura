import { isDraft } from '../../reactivity'
import { nextTick } from '../scheduler'
import { defineModel, modelManager, use } from '../index'

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

describe('defineModel', () => {
  it('should return the model', () => {
    const model = {
      state: {},
      reducers: {},
    }

    const modelA = defineModel(model)

    expect(model).toBe(modelA)
  })

  it("should return snapshot of the model's state", () => {
    const model = {
      state: {
        foo: {},
      },
    }

    const modelA = defineModel(model)

    const storeA = modelMgr.getModel('one', modelA)

    expect(isDraft(storeA.foo)).toBeFalsy()
  })

  describe('composing models', () => {
    it('should consume other models by "use()"', () => {
      const depOne = defineModel({
        state: { count: 0 },
        actions: {
          add(p: number) {
            this.count += p
          },
        },
      })

      const depTwo = defineModel({
        state: { count: 0 },
        actions: {
          add(p: number) {
            this.count += p
          },
        },
      })

      const model = defineModel(() => {
        const one = use('one', depOne)
        const two = use('two', depTwo)

        return {
          state: { value: 0 },
          actions: {
            add(p: number) {
              this.value += p
            },
            addDep(_: void) {
              one.add(1)
              two.add(1)
            },
          },
        }
      })

      const depOneStore = modelMgr.getModel('one', depOne)
      const depTwoStore = modelMgr.getModel('two', depTwo)
      const store = modelMgr.getModel('test', model)

      store.addDep()
      expect(store.$state).toEqual({ value: 0 })
      expect(depOneStore.$state).toEqual({ count: 1 })
      expect(depTwoStore.$state).toEqual({ count: 1 })

      store.add(1)
      expect(store.$state).toEqual({ value: 1 })
    })

    it("should reactive to dep's view", () => {
      const countModel = defineModel({
        state: { count: 1 },
        actions: {
          add(p: number) {
            this.count += p
          },
        },
        views: {
          double() {
            return this.count * 2
          },
        },
      })

      const model = defineModel(() => {
        const count = use('count', countModel)
        return {
          state: { value: 0 },
          actions: {
            add(p: number) {
              this.value += p
            },
          },
          views: {
            all() {
              return {
                value: this.value,
                depDouble: count.double,
              }
            },
          },
        }
      })

      const store = modelMgr.getModel('test', model)
      const depStore = modelMgr.getModel('count', countModel)

      let v = store.all
      expect(v).toEqual({
        value: 0,
        depDouble: 2,
      })
      expect(store.all).toBe(v)

      depStore.add(1)
      v = store.all
      expect(v).toEqual({
        value: 0,
        depDouble: 4,
      })
      expect(store.all).toBe(v)

      store.add(1)
      v = store.all
      expect(v).toEqual({
        value: 1,
        depDouble: 4,
      })
      expect(store.all).toBe(v)
    })

    it('should work under nested models with actions', async () => {
      const cModel = defineModel({
        state: { id: 'c', v: 0, t: 0 },
        actions: {
          add(p: number) {
            this.v += p
          },
          addT(p: number) {
            this.t += p
          },
        },
      })
      const bModel = defineModel(() => {
        const c = use('c', cModel)
        return {
          state: { id: 'b', v: 0, m: { n: {} as Record<string, number> } },
          actions: {
            add(key: string, p: number) {
              this.v += p
              this.m.n[key] = p
              c.addT(p)
            },
          },
        }
      })
      const aModel = defineModel(() => {
        const b = use('b', bModel)
        const c = use('c', cModel)
        return {
          state: { v: 0 },
          actions: {
            add(key: string, p: number) {
              this.v += p
              c.add(p)
              b.add(key, p)
            },
          },
        }
      })

      const aStore = modelMgr.getModel('a', aModel)
      const bStore = modelMgr.getModel('b', bModel)
      const cStore = modelMgr.getModel('c', cModel)

      aStore.add('a', 1)
      expect(aStore.v).toBe(1)
      expect(bStore.v).toBe(1)
      expect(bStore.m.n['a']).toBe(1)
      expect(cStore.v).toBe(1)
      expect(cStore.t).toBe(1)
    })
  })

  it('should throw when calling use() outside of a function model', () => {
    expect(() => use({ state: {} })).toThrow(/Invalid use\(\) call/)
  })

  it('should not trigger updates in nested action', async () => {
    const stateA = {
      value: 0,
    }
    const stateB = {
      anArr: [] as number[],
    }
    const mA = defineModel({
      state: stateA,
      actions: {
        async update(v: number) {
          this.value = v
        },
      },
    })
    const mB = defineModel(() => {
      const a = use('a', mA)
      return {
        state: stateB,
        views: {
          double() {
            return this.anArr.map((n) => n * 2)
          },
        },
        actions: {
          change(n: number) {
            this.anArr.push(n)
            a.update(n)
          },
        },
      }
    })

    const a = modelMgr.getModel('a', mA)
    const b = modelMgr.getModel('b', mB)
    b.$subscribe(() => {
      void b.double
    })
    b.change(1)
    expect(a.$rawState).toEqual({
      value: 1,
    })
    expect(b.$rawState).toEqual({
      anArr: [1],
    })
  })
})
