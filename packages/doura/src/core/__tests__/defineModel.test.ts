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
  it('should return the model', () => {
    const model = {
      name: 'a',
      state: {},
      reducers: {},
    }

    const modelA = defineModel(model)

    expect(model).toBe(modelA)
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

      const model = defineModel(({ use }) => {
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

      const model = defineModel(({ use }) => {
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
  })
})
