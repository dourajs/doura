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
  describe('type checking', () => {
    test('model is necessary', () => {
      expect(() => {
        // @ts-ignore
        const modelA = defineModel()
      }).toThrow()
    })

    test('name is not necessary', () => {
      expect(() => {
        defineModel(
          // @ts-ignore
          {
            state: {},
          }
        )
      }).not.toThrow()
    })

    test('state is necessary', () => {
      expect(() => {
        defineModel(
          // @ts-ignore
          {
            name: 'a',
          }
        )
      }).toThrow()
    })

    test('state could be a number', () => {
      expect(() => {
        defineModel({
          name: 'a',
          state: 1,
        })
      }).not.toThrow()
    })

    test('state could be a string', () => {
      expect(() => {
        defineModel({
          name: 'a',
          state: 'test',
        })
      }).not.toThrow()
    })

    test('state could be a array', () => {
      expect(() => {
        defineModel({
          name: 'a',
          state: [],
        })
      }).not.toThrow()
    })

    test('state could be a boolean', () => {
      expect(() => {
        defineModel({
          name: 'a',
          state: false,
        })
      }).not.toThrow()
    })

    test('state could be a undefined', () => {
      expect(() => {
        defineModel({
          name: 'a',
          state: undefined,
        })
      }).not.toThrow()
    })

    test('state could be a null', () => {
      expect(() => {
        defineModel({
          name: 'a',
          state: null,
        })
      }).not.toThrow()
    })

    test('state could not be a bigint', () => {
      expect(() => {
        defineModel({
          name: 'a',
          // @ts-ignore
          state: BigInt(1),
        })
      }).toThrow()
    })

    test('state could not be a symbol', () => {
      expect(() => {
        defineModel({
          name: 'a',
          // @ts-ignore
          state: Symbol('1'),
        })
      }).toThrow()
    })

    test('actions should be object', () => {
      expect(() => {
        defineModel({
          name: 'a',
          state: {},
          // @ts-ignore
          actions: 1,
        })
      }).toThrow()
    })

    test('views should be object', () => {
      expect(() => {
        defineModel({
          name: 'a',
          state: {},
          // @ts-ignore
          views: 1,
        })
      }).toThrow()
    })

    test('warn conflicted keys between state and view', () => {
      defineModel({
        name: 'a',
        state: {
          a: 0,
        },
        views: {
          a() {},
        },
      })
      expect(
        `key "a" in "views" is conflicted with the key in "state"`
      ).toHaveBeenWarned()
    })

    test('depends should be array or undefined', () => {
      expect(() => {
        defineModel(
          {
            name: 'a',
            state: {},
          },
          // @ts-ignore
          {}
        )
      }).toThrow()

      expect(() => {
        defineModel({
          name: 'a',
          state: {},
        })
        defineModel(
          {
            name: 'a',
            state: {},
          },
          []
        )
      }).not.toThrow()
    })
  })

  it('should return the model', () => {
    const model = {
      name: 'a',
      state: {},
      reducers: {},
    }

    const modelA = defineModel(model)

    expect(model).toBe(modelA)
  })

  describe('dependencies', () => {
    it('should access dependent models by this.$dep', () => {
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

      const model = defineModel(
        {
          name: 'model',
          state: { value: 0 },
          actions: {
            add(p: number) {
              this.value += p
            },
            addDep(_: void) {
              this.$dep.one.add(1)
              this.$dep.two.add(1)
            },
          },
        },
        [depOne, depTwo]
      )

      const depOneStore = modelMgr.getModel(depOne)
      const depTwoStore = modelMgr.getModel(depTwo)
      const store = modelMgr.getModel(model)

      store.addDep()
      expect(store.$state).toEqual({ value: 0 })
      expect(depOneStore.$state).toEqual({ count: 1 })
      expect(depTwoStore.$state).toEqual({ count: 1 })

      store.add(1)
      expect(store.$state).toEqual({ value: 1 })
    })

    it("should reactive to dep's view", () => {
      const dep = defineModel({
        name: 'dep',
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

      const model = defineModel(
        {
          name: 'model',
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
                depDouble: this.$dep.dep.double,
              }
            },
          },
        },
        [dep]
      )

      const store = modelMgr.getModel(model)
      const depStore = modelMgr.getModel(dep)

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
