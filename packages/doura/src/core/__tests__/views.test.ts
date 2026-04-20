import { defineModel, modelManager, use } from '../index'
import { nextTick } from '../scheduler'
import { isDraft } from '../../reactivity'

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

  it('should receive external params', () => {
    const count = defineModel({
      state: {
        count: 1,
      },
      views: {
        double(s, a: number) {
          return s.count * a
        },
      },
    })
    const store = modelMgr.getModel('test', count)

    expect(typeof store.double).toBe('function')
    expect(store.double(2)).toBe(2)
    expect(
      'The double in the views is using additional parameters.'
    ).toHaveBeenWarned()
  })

  // fixme: this test is not working
  it('receive external params - return same ref when params does not change', () => {
    const count = defineModel({
      state: {
        count: 1,
      },
      views: {
        double(s, a: number) {
          return {}
        },
      },
    })
    const store = modelMgr.getModel('test', count)

    expect(typeof store.double).toBe('function')
    const a = store.double(2)
    expect(store.double(2)).toBe(a)
    const b = store.double(3)
    expect(store.double(3)).toBe(b)
    expect(
      'The double in the views is using additional parameters.'
    ).toHaveBeenWarned()
  })

  it('should warn when changing state in a view', () => {
    let initState = {
      a: 0,
    }
    const model = defineModel({
      state: initState,
      views: {
        view() {
          this.a = 1
          return this.a
        },
      },
    })
    const store = modelMgr.getModel('test', model)
    expect(() => store.view).toThrow()
    expect(
      'Attempting to change state "a". State are readonly in "views"'
    ).toHaveBeenWarned()
  })

  it('should warn when calling action in a view', () => {
    let initState = {
      a: 0,
    }
    const model = defineModel({
      state: initState,
      actions: {
        set(v: number) {
          this.a = v
        },
      },
      views: {
        view() {
          ;(this as any).set(1)
          return this.a
        },
      },
    })
    const store = modelMgr.getModel('test', model)
    expect(store.view).toEqual(0)
    expect(
      'Action "set" is called in view function, it will be ignored and has no effect.'
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

  it("should not be invoked when extra args don't change", () => {
    let calltime = 0
    const model = defineModel({
      state: {
        b: 1,
      },
      actions: {},
      views: {
        doubleB(s, n: number) {
          calltime++
          return s.b * n
        },
      },
    })
    const store = modelMgr.getModel('test', model)

    expect(calltime).toBe(0)
    store.doubleB(1)
    expect(calltime).toBe(1)
    store.doubleB(1)
    expect(calltime).toBe(1)
    expect(
      'The doubleB in the views is using additional parameters.'
    ).toHaveBeenWarned()
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
      const model = defineModel(() => {
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
      const model = defineModel(() => {
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

  // ---------------------------------------------------------------
  // Known limitation: stale view snapshot after moving a draft
  // across parent keys.
  //
  // ## Root cause
  // DraftState.parent is set once at creation time and never updated.
  // When a draft proxy is assigned to a different parent via SET trap,
  // `addChildRef` / `removeChildRef` correctly maintain `children`
  // (used by BFS in snapshot()), but the child's `parent` pointer
  // still refers to the original parent.
  //
  // Two propagation paths depend on `parent`:
  //
  //   1. markChanged(state)  — bubbles `modified = true` up the
  //      parent chain. After the move, mutations inside the child
  //      bubble toward the OLD parent. Because both old and new
  //      parents share the same root, `root.modified` is still set
  //      correctly, so the root snapshot is fine.
  //
  //   2. triggerDraft(state) — walks up the parent chain setting
  //      `view.mightChange = true` on views that called trackDraft()
  //      at each level. After the move, the walk goes through the OLD
  //      parent chain, so views tracking the NEW parent never receive
  //      `mightChange = true`.  Their `getSnapshot()` returns the
  //      cached (stale) snapshot.
  //
  // ## Why this is not fixed yet
  // Updating `parent` in the SET trap is not trivial because a single
  // draft can be assigned to multiple keys (aliasing: `this.x = this.y
  // = someDraft`). `parent` is a single pointer, so it cannot
  // represent multiple parents.  A correct fix would need either:
  //
  //   a) Replace `parent` with a Set<DraftState> of parents, and walk
  //      ALL parent chains in markChanged / triggerDraft.
  //   b) Decouple the upward propagation from the `parent` pointer
  //      entirely — e.g. use the `children` graph (already correct)
  //      to build a reverse index, or propagate via a different
  //      mechanism (root-level dirty set).
  //   c) Forbid cross-key draft proxy assignment at the API level
  //      (too restrictive; breaks legitimate patterns like
  //      `this.selected = this.items[i]`).
  //
  // The scope of the fix and the rarity of the pattern in real-world
  // code (most actions assign plain values, not draft proxies) means
  // this is documented as a known limitation for now.
  // ---------------------------------------------------------------
  it('known limitation: view returns stale snapshot after draft is moved to a different parent', () => {
    const model = defineModel({
      state: {
        a: { nested: { x: 1 } },
        b: {} as any,
      },
      views: {
        // View only reads `this.b` — tracks b_state via trackDraft,
        // does NOT track any deeper child state.
        bSubtree() {
          return this.b
        },
      },
      actions: {
        // Move a.nested → b.nested by assigning the draft proxy.
        move() {
          this.b.nested = this.a.nested // assigns nested_draft_proxy
          delete (this.a as any).nested
        },
        // Mutate the already-moved nested object.
        mutateNested() {
          this.b.nested.x = 2
        },
      },
    })

    const store = modelMgr.getModel('test', model)

    // After move(), the view correctly picks up the new subtree.
    store.move()
    expect(store.bSubtree).toEqual({ nested: { x: 1 } })

    // Root state is always correct (markChanged reaches root).
    store.mutateNested()
    expect(store.$state.b.nested.x).toBe(2) // root snapshot: correct

    // View snapshot is stale: triggerDraft walked
    //   nested_state → a_state (old parent) → root_state
    // instead of
    //   nested_state → b_state → root_state
    // so the view tracking b_state never got mightChange = true.
    //
    // When this limitation is fixed, change the assertion below to:
    //   expect(store.bSubtree.nested.x).toBe(2)
    expect(store.bSubtree.nested.x).toBe(1) // stale — known limitation
  })
})

describe('createView', () => {
  it('should not return a draft', () => {
    const model = defineModel({
      state: {
        a: {},
      },
    })
    const store = modelMgr.getModel('test', model)

    const view = store.$createView((s) => s.a)
    expect(isDraft(view())).toBeFalsy()
  })

  describe('viewInstances cleanup on destroy', () => {
    function getModelInternal(name: string): any {
      return (modelMgr as any)._models.get(name)
    }

    it('should remove view from viewInstances when destroyed', () => {
      const model = defineModel({
        state: { value: 1 },
        views: {
          double() {
            return this.value * 2
          },
        },
      })
      const store = modelMgr.getModel('test', model)
      const internal = getModelInternal('test')
      const baseline = internal.viewInstances.length

      const view = store.$createView((s) => s.value)
      expect(internal.viewInstances.length).toBe(baseline + 1)

      view.destroy()
      expect(internal.viewInstances.length).toBe(baseline)
    })

    it('should not accumulate viewInstances across create/destroy cycles', () => {
      const model = defineModel({
        state: { value: 1 },
      })
      const store = modelMgr.getModel('test', model)
      const internal = getModelInternal('test')
      const baseline = internal.viewInstances.length

      for (let i = 0; i < 20; i++) {
        const view = store.$createView((s) => s.value)
        view.destroy()
      }

      expect(internal.viewInstances.length).toBe(baseline)
    })
  })

  describe('getApi() cache invalidation with cross-model dependencies', () => {
    test('parent $getApi() should reflect child state changes', async () => {
      const childModel = defineModel({
        state: { count: 0 },
        actions: {
          inc() {
            this.count += 1
          },
        },
      })

      const parentModel = defineModel(() => {
        const child = use('child', childModel)
        return {
          state: { value: 1 },
          views: {
            childCount() {
              return child.count
            },
          },
        }
      })

      const child = modelMgr.getModel('child', childModel)
      const parent = modelMgr.getModel('parent', parentModel)

      // Initial: parent view reads child.count = 0
      const api1 = parent.$getApi()
      expect(api1.childCount).toBe(0)

      // Mutate child
      child.inc()
      await nextTick()

      // Parent's $getApi() should return updated view reflecting child.count = 1
      const api2 = parent.$getApi()
      expect(api2.childCount).toBe(1)
    })
  })

  /**
   * Validates the "no-arg view returning a closure" pattern as an alternative
   * to the soon-to-be-deprecated parameterized view.
   *
   * Shape: `getById: (s) => (id) => s.users[id]`
   *
   * Key invariants:
   *  - Reactivity is a property of the active effect at call-site, not of
   *    the function being called. Whoever invokes the closure inside an
   *    effect (another view, an external subscriber, a React selector)
   *    registers the deps.
   *  - Tracking granularity equals property-access depth. Whatever gets
   *    read is what gets tracked.
   */
  describe('closure-returning view', () => {
    // ---- same-model usage ----

    it('re-runs a sibling view when the tracked entry is replaced (same model)', () => {
      const model = defineModel({
        state: {
          users: { a: { name: 'Alice' } } as Record<string, { name: string }>,
          activeId: 'a',
        },
        actions: {
          replace(id: string, user: { name: string }) {
            this.users[id] = user
          },
          setActive(id: string) {
            this.activeId = id
          },
        },
        views: {
          getById: (s) => (id: string) => s.users[id],
          activeUser() {
            calls++
            return this.getById(this.activeId) // consumes the closure
          },
        },
      })
      let calls = 0
      const store = modelMgr.getModel('test', model)

      expect(store.activeUser).toEqual({ name: 'Alice' })
      expect(calls).toBe(1)

      // cache hit
      expect(store.activeUser).toEqual({ name: 'Alice' })
      expect(calls).toBe(1)

      // replace entry -> triggers (users, 'a') -> view re-runs
      store.replace('a', { name: 'Alice2' })
      expect(store.activeUser).toEqual({ name: 'Alice2' })
      expect(calls).toBe(2)
    })

    it('re-runs a sibling view on deep change when leaf is read (same model)', () => {
      const model = defineModel({
        state: {
          users: {
            a: { name: 'Alice' },
            b: { name: 'Bob' },
          } as Record<string, { name: string }>,
          activeId: 'a',
        },
        actions: {
          rename(id: string, name: string) {
            this.users[id].name = name
          },
          setActive(id: string) {
            this.activeId = id
          },
        },
        views: {
          getById: (s) => (id: string) => s.users[id],
          activeName() {
            calls++
            return this.getById(this.activeId).name // reads the leaf
          },
        },
      })
      let calls = 0
      const store = modelMgr.getModel('test', model)

      expect(store.activeName).toBe('Alice')
      expect(calls).toBe(1)

      // mutate active entry -> re-runs
      store.rename('a', 'Alice2')
      expect(store.activeName).toBe('Alice2')
      expect(calls).toBe(2)

      // mutate inactive entry -> not tracked, cache hit
      store.rename('b', 'Bob2')
      expect(store.activeName).toBe('Alice2')
      expect(calls).toBe(2)

      // switch activeId -> re-runs
      store.setActive('b')
      expect(store.activeName).toBe('Bob2')
      expect(calls).toBe(3)
    })

    it('external caller (no active effect) just reads current value, no subscription', () => {
      const model = defineModel({
        state: {
          users: { a: { name: 'Alice' } } as Record<string, { name: string }>,
        },
        actions: {
          rename(id: string, name: string) {
            this.users[id].name = name
          },
        },
        views: {
          getById: (s) => (id: string) => s.users[id],
        },
      })
      const store = modelMgr.getModel('test', model)

      // Direct external call returns a live snapshot view of the current state
      expect(store.getById('a')).toEqual({ name: 'Alice' })

      store.rename('a', 'Alice2')
      // Next call sees the updated value — no caller-side effect was involved,
      // so there's nothing to "invalidate"; the closure just reads fresh.
      expect(store.getById('a')).toEqual({ name: 'Alice2' })
    })

    // ---- cross-model usage ----

    it('rebuilds when the tracked entry is replaced (cross-model)', () => {
      const modelA = defineModel({
        state: {
          users: { a: { name: 'Alice' } } as Record<string, { name: string }>,
        },
        actions: {
          replace(id: string, user: { name: string }) {
            this.users[id] = user
          },
        },
        views: {
          getById: (s) => (id: string) => s.users[id],
        },
      })

      let calls = 0
      const modelB = defineModel(() => {
        const a = use('a', modelA)
        return {
          state: { activeId: 'a' },
          views: {
            activeUser() {
              calls++
              return a.getById(this.activeId) // only reads users[id]
            },
          },
        }
      })

      const a = modelMgr.getModel('a', modelA)
      const b = modelMgr.getModel('b', modelB)

      expect(b.activeUser).toEqual({ name: 'Alice' })
      expect(calls).toBe(1)

      // cache hit
      expect(b.activeUser).toEqual({ name: 'Alice' })
      expect(calls).toBe(1)

      // replacing the whole entry triggers (users, 'a') -> view re-runs
      a.replace('a', { name: 'Alice2' })
      expect(b.activeUser).toEqual({ name: 'Alice2' })
      expect(calls).toBe(2)
    })

    it('rebuilds when a deep field is read inside the view (cross-model)', () => {
      const modelA = defineModel({
        state: {
          users: {
            a: { name: 'Alice' },
            b: { name: 'Bob' },
          } as Record<string, { name: string }>,
        },
        actions: {
          rename(id: string, name: string) {
            this.users[id].name = name
          },
        },
        views: {
          getById: (s) => (id: string) => s.users[id],
        },
      })

      let calls = 0
      const modelB = defineModel(() => {
        const a = use('a', modelA)
        return {
          state: { activeId: 'a' },
          actions: {
            setActive(id: string) {
              this.activeId = id
            },
          },
          views: {
            activeName() {
              calls++
              return a.getById(this.activeId).name // reads the leaf
            },
          },
        }
      })

      const a = modelMgr.getModel('a', modelA)
      const b = modelMgr.getModel('b', modelB)

      expect(b.activeName).toBe('Alice')
      expect(calls).toBe(1)

      // cache hit
      expect(b.activeName).toBe('Alice')
      expect(calls).toBe(1)

      // rename the active entry -> view re-runs
      a.rename('a', 'Alice2')
      expect(b.activeName).toBe('Alice2')
      expect(calls).toBe(2)

      // rename an inactive entry -> not tracked, cache hit
      a.rename('b', 'Bob2')
      expect(b.activeName).toBe('Alice2')
      expect(calls).toBe(2)

      // switching activeId -> view re-runs (depends on b.activeId)
      b.setActive('b')
      expect(b.activeName).toBe('Bob2')
      expect(calls).toBe(3)

      // after switching, mutating the previously-active entry is no longer
      // tracked — re-collection rebuilt deps to users.b.name
      a.rename('a', 'AliceX')
      expect(b.activeName).toBe('Bob2')
      expect(calls).toBe(3)
    })

    it('same granularity limit applies to parameterized views (not a closure issue)', () => {
      const modelA = defineModel({
        state: {
          users: { a: { name: 'Alice' } } as Record<string, { name: string }>,
        },
        actions: {
          rename(id: string, name: string) {
            this.users[id].name = name
          },
        },
        views: {
          // Parameterized view form (emits deprecation warning in dev)
          getByIdParam(s, id: string) {
            return s.users[id]
          },
        },
      })

      let calls = 0
      const modelB = defineModel(() => {
        const a = use('a', modelA)
        return {
          state: { activeId: 'a' },
          views: {
            activeUser() {
              calls++
              return a.getByIdParam(this.activeId) // only reads users[id]
            },
          },
        }
      })

      const a = modelMgr.getModel('a', modelA)
      const b = modelMgr.getModel('b', modelB)

      expect(b.activeUser).toEqual({ name: 'Alice' })
      expect(calls).toBe(1)

      // Mutating users.a.name only triggers (users.a, 'name').
      // The view read users[id] one level above, so it does NOT re-run.
      // This proves the limitation is access depth, not closure vs param.
      a.rename('a', 'Alice2')
      expect(calls).toBe(1)

      expect(
        'The getByIdParam in the views is using additional parameters.'
      ).toHaveBeenWarned()
    })
  })
})
