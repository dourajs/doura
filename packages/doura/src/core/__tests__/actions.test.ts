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

const timeout = (n: number = 0) => new Promise((r) => setTimeout(r, n))

describe('defineModel/actions', () => {
  it('should change the state', () => {
    const count = defineModel({
      state: { value: 0 },
      actions: {
        add() {
          this.value += 1
        },
      },
    })

    const store = modelMgr.getModel('count', count)
    expect(typeof store.add).toBe('function')

    store.add()
    expect(store.$state).toEqual({ value: 1 })

    store.add()
    expect(store.$state).toEqual({ value: 2 })
  })

  it('should accept params', () => {
    const model = defineModel({
      state: { values: [] } as any,
      actions: {
        push(...values: any[]) {
          this.values.push(...values)
        },
      },
    })

    const store = modelMgr.getModel('test', model)

    store.push(1)
    expect(store.$state.values).toEqual([1])

    store.push(2, 3)
    expect(store.$state.values).toEqual([1, 2, 3])
  })

  it('should return value', () => {
    const model = defineModel({
      state: { values: null },
      actions: {
        set() {
          return 'result'
        },
      },
    })

    const store = modelMgr.getModel('test', model)
    expect(store.set()).toBe('result')
  })

  it('should support async actions', async () => {
    const model = defineModel({
      state: { value: 0 },
      actions: {
        async asyncAction(): Promise<void> {
          this.value += 1
          await timeout(1000)
          this.value += 1
        },
      },
    })

    const store = modelMgr.getModel('test', model)

    store.asyncAction()
    expect(store.$state.value).toBe(1)
    await timeout(1000)
    expect(store.$state.value).toBe(2)
  })

  it('should batch updates and emit change event once', async () => {
    const fn = jest.fn()
    const count = defineModel({
      state: { value: 0 },
      actions: {
        inc() {
          this.value += 1
          this.value += 1
        },
      },
    })

    const store = modelMgr.getModel('count', count)
    store.$subscribe(fn)
    store.inc()
    expect(fn).toHaveBeenCalledTimes(1)
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(store.$state).toEqual({ value: 2 })
  })

  it('should batch updates and emit change event once (nested actions)', async () => {
    const fn = jest.fn()
    const count = defineModel({
      state: { value: 0 },
      actions: {
        inc() {
          this.value += 1
          this.nested()
          this.value += 1
        },
        nested() {
          this.value += 1
          this.value += 1
        },
      },
    })

    const store = modelMgr.getModel('count', count)
    store.$subscribe(fn)
    store.inc()
    expect(fn).toHaveBeenCalledTimes(1)
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(store.$state).toEqual({ value: 4 })
  })

  it('should batch update and only triggered once (async action)', async () => {
    const fn = jest.fn()
    const count = defineModel({
      state: { value: 0 },
      actions: {
        async inc() {
          this.value += 1
          this.value += 1
          await timeout(10)
          this.value += 1
          this.value += 1
        },
      },
    })

    const store = modelMgr.getModel('count', count)
    store.$subscribe(fn)
    store.inc()
    expect(fn).toHaveBeenCalledTimes(1)
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(store.$state).toEqual({ value: 2 })
    await timeout(10)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(store.$state).toEqual({ value: 4 })
  })

  it("should not trigger change event if state doesn't change", async () => {
    const fn = jest.fn()
    const count = defineModel({
      state: { value: 0 },
      actions: {
        inc() {
          this.value++
        },
        doNothing() {
          // do nothing
        },
      },
    })

    const store = modelMgr.getModel('count', count)
    store.$subscribe(fn)
    store.inc()
    expect(fn).toHaveBeenCalledTimes(1)
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    store.doNothing()
    expect(fn).toHaveBeenCalledTimes(1)
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(store.$state).toEqual({ value: 1 })
  })

  describe('structural sharing', () => {
    it('unmodified subtrees keep same reference after action', () => {
      const state = {
        anObj: { a: 'a', aNestObj: { b: 'b' } },
        anArr: [1],
        c: 0,
      }
      const model = defineModel({
        state,
        actions: {
          changeC() {
            this.c = 1
          },
        },
      })

      const store = modelMgr.getModel('test', model)
      store.changeC()
      expect(store.$rawState.anObj).toBe(state.anObj)
      expect(store.$rawState.anObj.aNestObj).toBe(state.anObj.aNestObj)
      expect(store.$rawState.anArr).toBe(state.anArr)
    })

    it('modified subtrees get new references', () => {
      const state = {
        anObj: { a: 'a', aNestObj: { b: 'b' } },
        anArr: [1],
      }
      const model = defineModel({
        state,
        actions: {
          change() {
            this.anObj.aNestObj.b = 'bb'
            this.anArr.push(2)
          },
        },
      })

      const store = modelMgr.getModel('test', model)
      store.change()
      // modified path: root → anObj → aNestObj all get new references
      expect(store.$rawState.anObj).not.toBe(state.anObj)
      expect(store.$rawState.anObj.aNestObj).not.toBe(state.anObj.aNestObj)
      expect(store.$rawState.anArr).not.toBe(state.anArr)
    })

    it('unmodified subtrees keep same reference across multiple actions', () => {
      const model = defineModel({
        state: {
          step: 1,
          anArr: [{ key: 1 }],
        },
        actions: {
          changeStep() {
            this.step += 1
          },
          changeArr() {
            this.anArr[0].key = 2
          },
        },
      })

      const store = modelMgr.getModel('test', model)
      store.changeArr()
      const arr = store.anArr
      // change another prop but not arr
      store.changeStep()
      expect(store.anArr).toBe(arr)
    })

    it('modified subtree gets new reference, sibling keeps same reference', () => {
      const model = defineModel({
        state: {
          a: { value: 1 },
          b: { value: 2 },
        },
        actions: {
          changeA() {
            this.a.value += 1
          },
        },
      })

      const store = modelMgr.getModel('test', model)
      const oldA = store.a
      const oldB = store.b

      store.changeA()
      expect(store.a).not.toBe(oldA)
      expect(store.b).toBe(oldB)
    })

    it('reference changes on modify then stabilizes on subsequent read-only actions', () => {
      const model = defineModel({
        state: {
          data: { value: 1 },
          count: 0,
        },
        actions: {
          changeData() {
            this.data.value += 1
          },
          changeCount() {
            this.count += 1
          },
        },
      })

      const store = modelMgr.getModel('test', model)

      // modify data
      store.changeData()
      const dataAfterChange = store.data

      // subsequent actions don't touch data — reference should stay stable
      store.changeCount()
      expect(store.data).toBe(dataAfterChange)
      store.changeCount()
      expect(store.data).toBe(dataAfterChange)
    })

    it('deeply nested modification only changes references on the modified path', () => {
      const model = defineModel({
        state: {
          branch1: { nested: { deep: { value: 1 } } },
          branch2: { nested: { deep: { value: 2 } } },
        },
        actions: {
          changeBranch1() {
            this.branch1.nested.deep.value = 99
          },
        },
      })

      const store = modelMgr.getModel('test', model)
      const oldBranch1 = store.branch1
      const oldBranch1Nested = store.branch1.nested
      const oldBranch1Deep = store.branch1.nested.deep
      const oldBranch2 = store.branch2

      store.changeBranch1()

      // modified path: all references change
      expect(store.branch1).not.toBe(oldBranch1)
      expect(store.branch1.nested).not.toBe(oldBranch1Nested)
      expect(store.branch1.nested.deep).not.toBe(oldBranch1Deep)
      expect(store.branch1.nested.deep.value).toBe(99)

      // sibling branch: reference unchanged
      expect(store.branch2).toBe(oldBranch2)
    })

    it('old snapshot is immutable — not affected by new actions', () => {
      const model = defineModel({
        state: {
          step: 1,
          anArr: [{ key: 1 }],
        },
        actions: {
          changeArr() {
            this.anArr[0].key += 1
          },
        },
      })

      const store = modelMgr.getModel('test', model)
      store.changeArr()
      const snapshot1 = store.$rawState
      const arr1 = snapshot1.anArr

      store.changeArr()
      const snapshot2 = store.$rawState

      // old snapshot not affected
      expect(snapshot1.anArr).toBe(arr1)
      expect(snapshot1.anArr[0].key).toBe(2)
      // new snapshot has new value
      expect(snapshot2.anArr[0].key).toBe(3)
      // different references
      expect(snapshot2.anArr).not.toBe(snapshot1.anArr)
    })

    it('draft nested in plain object: subsequent action updates are reflected', () => {
      const model = defineModel({
        state: {
          nested: { a: 1 },
          wrapper: null as any,
        },
        actions: {
          wrapNested() {
            // wrap a draft reference inside a plain object
            this.wrapper = { inner: this.nested }
          },
          updateNested() {
            this.nested.a += 1
          },
        },
      })

      const store = modelMgr.getModel('test', model)

      // action 1: wrap draft in plain object
      store.wrapNested()
      const snap1 = store.$rawState
      expect(snap1.nested).toEqual({ a: 1 })
      expect(snap1.wrapper.inner).toEqual({ a: 1 })
      // wrapper.inner should resolve to the same object as nested
      expect(snap1.wrapper.inner).toBe(snap1.nested)

      // action 2: mutate nested
      store.updateNested()
      const snap2 = store.$rawState
      expect(snap2.nested).toEqual({ a: 2 })
      // wrapper was not reassigned — it keeps the snapshot-time value from action 1
      expect(snap2.wrapper.inner).toEqual({ a: 1 })
      // snap1 immutability: not affected by action 2
      expect(snap1.nested).toEqual({ a: 1 })
    })

    it('draft nested in plain object with re-wrap: picks up new value', () => {
      const model = defineModel({
        state: {
          nested: { a: 1 },
          wrapper: null as any,
        },
        actions: {
          wrapNested() {
            this.wrapper = { inner: this.nested }
          },
          updateNestedAndReWrap() {
            this.nested.a += 1
            this.wrapper = { inner: this.nested }
          },
        },
      })

      const store = modelMgr.getModel('test', model)

      store.wrapNested()
      const snap1 = store.$rawState
      expect(snap1.wrapper.inner).toEqual({ a: 1 })

      // action 2: mutate nested AND re-wrap
      store.updateNestedAndReWrap()
      const snap2 = store.$rawState
      expect(snap2.nested).toEqual({ a: 2 })
      // re-wrapped — wrapper.inner should reflect the update
      expect(snap2.wrapper.inner).toEqual({ a: 2 })
      expect(snap2.wrapper.inner).toBe(snap2.nested)
      // snap1 immutability
      expect(snap1.wrapper.inner).toEqual({ a: 1 })
      expect(snap1.nested).toEqual({ a: 1 })
    })

    it('draft referenced by multiple props in root: all resolve correctly in first snapshot', () => {
      const model = defineModel({
        state: {
          nested: { a: 1 },
          ref: null as any,
          wrapper: null as any,
        },
        actions: {
          setup() {
            this.nested.a = 2
            this.wrapper = { inner: this.nested }
          },
          updateNested() {
            this.nested.a = 3
          },
        },
      })

      const store = modelMgr.getModel('test', model)

      // action 1: multiple references to same draft
      store.setup()
      const snap1 = store.$rawState
      expect(snap1.nested).toEqual({ a: 2 })
      expect(snap1.wrapper.inner).toEqual({ a: 2 })
      // all point to the same resolved object
      expect(snap1.wrapper.inner).toBe(snap1.nested)

      // action 2: only mutate nested — ref and wrapper.inner are NOT re-assigned
      store.updateNested()
      const snap2 = store.$rawState
      expect(snap2.nested).toEqual({ a: 3 })

      // wrapper.inner is inside a plain object — frozen at action 1 snapshot value
      expect(snap2.wrapper.inner).toEqual({ a: 2 })

      // snap1 immutability
      expect(snap1.nested).toEqual({ a: 2 })
    })

    it('direct draft alias: ref tracks nested across multiple snapshots', () => {
      const model = defineModel({
        state: {
          nested: { a: 1 },
          ref: null as any,
        },
        actions: {
          setup() {
            this.nested.a = 2
            this.ref = this.nested // direct draft-to-draft alias, no plain object
          },
          updateNested() {
            this.nested.a = 3
          },
        },
      })

      const store = modelMgr.getModel('test', model)

      store.setup()
      const snap1 = store.$rawState
      expect(snap1.nested).toEqual({ a: 2 })
      expect(snap1.ref).toEqual({ a: 2 })
      expect(snap1.ref).toBe(snap1.nested)

      // action 2: only mutate nested — ref should follow
      store.updateNested()
      const snap2 = store.$rawState
      expect(snap2.nested).toEqual({ a: 3 })
      expect(snap2.ref).toEqual({ a: 3 })
      expect(snap2.ref).toBe(snap2.nested)

      // snap1 immutability
      expect(snap1.nested).toEqual({ a: 2 })
      expect(snap1.ref).toEqual({ a: 2 })
    })

    it('unmodified subtrees share reference between consecutive snapshots', () => {
      const model = defineModel({
        state: {
          step: 1,
          anArr: [{ key: 1 }],
        },
        actions: {
          changeStep() {
            this.step += 1
          },
        },
      })

      const store = modelMgr.getModel('test', model)
      store.changeStep()
      const snapshot1 = store.$rawState
      store.changeStep()
      const snapshot2 = store.$rawState

      // step changed — snapshots are different objects
      expect(snapshot2).not.toBe(snapshot1)
      // anArr not changed — shared between snapshots
      expect(snapshot2.anArr).toBe(snapshot1.anArr)
    })
  })

  it('should access views by `this`', () => {
    const model = defineModel({
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

    const store = modelMgr.getModel('test', model)

    store.set(5)
    expect(store.valuePlusN).toBe(6)
  })

  describe('this.$state', () => {
    it('should change value by $state', () => {
      const model = defineModel({
        state: { value: 1 },
        actions: {
          add(n: number) {
            this.$state.value += n
          },
        },
      })

      const store = modelMgr.getModel('test', model)

      store.add(9)
      expect(store.$state.value).toBe(10)
    })

    it('should always return the newest state', () => {
      const state: number[] = []
      const count = defineModel({
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

      const store = modelMgr.getModel('count', count)

      store.makeCall(2)
      expect(state).toEqual([1, 2])
    })

    // todo: fixme
    it.skip('should throw error if changed state not by reducer in development', async () => {
      const count = defineModel({
        state: { value: 0 },
      })

      const store = modelMgr.getModel('count', count)

      const state = store.$state
      state.value = 1

      expect(
        'Set operation on key "value" failed: target is readonly.'
      ).toHaveBeenWarned()
    })

    it('should replace state by assgining to this.$state', () => {
      const count = defineModel({
        state: { a: 1, b: 1 },
        actions: {
          replace(newState: any): void {
            this.$state = newState
          },
        },
      })

      const store = modelMgr.getModel('count', count)

      const newState1 = {
        a: 2,
      }
      store.replace(newState1)
      expect(store.$state).toEqual(newState1)

      const newState2: any[] = []
      store.replace(newState2)
      expect(store.$state).toEqual(newState2)
    })

    it('should error when assign Symbol or BigInt to this.$state', () => {
      const count = defineModel({
        state: { value: 0 },
        actions: {
          replace(value: any): void {
            this.$state = value
          },
        },
      })

      const store = modelMgr.getModel('test', count)
      expect(store.$state).toEqual({ value: 0 })

      expect(() => store.replace(Symbol('foo') as any)).toThrow()
      expect(() => store.replace(BigInt(1111) as any)).toThrow()
      expect(
        "[Doura warn] 'BigInt' and 'Symbol' are not assignable to the State"
      ).toHaveBeenWarnedTimes(2)
    })
  })
})
