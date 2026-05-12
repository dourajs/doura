import { isDraft } from '../../reactivity'
import { defineModel, modelManager } from '../index'

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
  it('should wrap model options under $options', () => {
    const model = {
      name: 'model',
      state: {},
      reducers: {},
    }

    const modelA = defineModel(model)

    expect(modelA).not.toBe(model)
    expect(modelA.$options).toBe(model)
    expect(Object.keys(modelA)).toEqual([])
  })

  it("should return snapshot of the model's state", () => {
    const model = {
      name: 'one',
      state: {
        foo: {},
      },
    }

    const modelA = defineModel(model)

    const storeA = modelMgr.getModel(modelA)

    expect(isDraft(storeA.foo)).toBeFalsy()
  })

  it('should allow definition refs named like model option fields', () => {
    const model = defineModel({
      name: 'optionFieldRefs',
      state: {},
      queries: {
        state: async () => 'query-state',
        name: async () => 'query-name',
        actions: async () => 'query-actions',
        views: async () => 'query-views',
        models: async () => 'query-models',
        queries: async () => 'query-queries',
      },
    })

    expect(typeof model.state).toBe('function')
    expect(typeof model.name).toBe('function')
    expect(typeof model.actions).toBe('function')
    expect(typeof model.views).toBe('function')
    expect(typeof model.models).toBe('function')
    expect(typeof model.queries).toBe('function')
    expect(model.views).not.toBe(model.queries)
    expect(model.$options.name).toBe('optionFieldRefs')
  })

  it('should reject definition refs named $options', () => {
    expect(() =>
      defineModel({
        name: 'reservedQueryRef',
        state: {},
        queries: {
          $options: async () => 1,
        },
      } as any)
    ).toThrow(/key "\$options" in "queries".*reserved model definition/)

    expect(() =>
      defineModel({
        name: 'reservedActionRef',
        state: {},
        actions: {
          $options() {
            return 1
          },
        },
      } as any)
    ).toThrow(/key "\$options" in "actions".*reserved model definition/)
  })

  it('should reject actions that conflict with query refs', () => {
    expect(() =>
      defineModel({
        name: 'actionQueryConflict',
        state: {},
        actions: {
          refresh() {
            return 1
          },
        },
        queries: {
          refresh: async () => 1,
        },
      } as any)
    ).toThrow(/key "refresh" in "actions".*key in "queries"/)
  })

  describe('composing models', () => {
    it('should consume other models by "models"', () => {
      const depOne = defineModel({
        name: 'one',
        state: { count: 0 },
        actions: {
          add(p: number) {
            this.count += p
          },
        },
      })

      const depTwo = defineModel({
        name: 'two',
        state: { count: 0 },
        actions: {
          add(p: number) {
            this.count += p
          },
        },
      })

      const model = defineModel({
        name: 'test',
        state: { value: 0 },
        models: [depOne, depTwo],
        actions: {
          add(p: number) {
            this.value += p
          },
          addDep(_: void) {
            this.one.add(1)
            this.two.add(1)
          },
        },
      })

      const depOneStore = modelMgr.getModel(depOne)
      const depTwoStore = modelMgr.getModel(depTwo)
      const store = modelMgr.getModel(model)

      expect(store.one).toBe(depOneStore)
      expect(store.two).toBe(depTwoStore)
      expect(store.$models.one).toBe(depOneStore)
      expect(store.$models.two).toBe(depTwoStore)

      store.addDep()
      expect(store.$state).toEqual({ value: 0 })
      expect(depOneStore.$state).toEqual({ count: 1 })
      expect(depTwoStore.$state).toEqual({ count: 1 })

      store.add(1)
      expect(store.$state).toEqual({ value: 1 })
    })

    it("should reactive to dep's view", () => {
      const countModel = defineModel({
        name: 'count',
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

      const model = defineModel({
        name: 'test',
        state: { value: 0 },
        models: [countModel],
        actions: {
          add(p: number) {
            this.value += p
          },
        },
        views: {
          all() {
            return {
              value: this.value,
              depDouble: this.count.double,
            }
          },
        },
      })

      const store = modelMgr.getModel(model)
      const depStore = modelMgr.getModel(countModel)

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

    it('should reject duplicated model keys', () => {
      const child = defineModel({
        name: 'child',
        state: { value: 0 },
      })

      expect(() =>
        defineModel({
          name: 'parent',
          state: {},
          models: [child, child],
        } as any)
      ).toThrow(/model "child" is duplicated in "models"/)
    })

    it('should reject conflicted model keys', () => {
      const child = defineModel({
        name: 'child',
        state: { value: 0 },
      })

      expect(() =>
        // @ts-expect-error - intentional runtime validation fixture
        defineModel({
          name: 'parent',
          state: { child: 1 },
          models: [child],
        })
      ).toThrow(/key "child" in "models".*key in "state"/)
    })
  })

  it('should not trigger updates in nested action', async () => {
    const stateA = {
      value: 0,
    }
    const stateB = {
      anArr: [] as number[],
    }
    const mA = defineModel({
      name: 'a',
      state: stateA,
      actions: {
        async update(v: number) {
          this.value = v
        },
      },
    })
    const mB = defineModel({
      name: 'b',
      state: stateB,
      models: [mA],
      views: {
        double() {
          return this.anArr.map((n) => n * 2)
        },
      },
      actions: {
        change(n: number) {
          this.anArr.push(n)
          this.a.update(n)
        },
      },
    })

    const a = modelMgr.getModel(mA)
    const b = modelMgr.getModel(mB)
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
