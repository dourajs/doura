import React, { StrictMode, useMemo, useState } from 'react'
import { render, act } from '@testing-library/react'
import {
  doura,
  defineModel,
  nextTick,
  Model,
  ModelDefinition,
  Selector,
  ModelAPI,
  ModelActions,
} from 'doura'
import {
  useDetachedModel,
  useModelImpl,
  useStaticModelImpl,
} from '../src/useModel'
import {
  DouraRoot,
  useModel,
  useStaticModel,
  createContainer,
} from '../src/index'
import type { UseSharedModel, UseStaticModel } from '../src/types'
import { countModel } from './models'

/**
 * Access the ModelInternal for a named model from the store.
 * Uses runtime access to TS-private _models map — acceptable for
 * white-box leak verification.
 */
function getInternal(store: ReturnType<typeof doura>, name: string): any {
  return (store as any)._models.get(name)
}

beforeEach(() => {
  jest.useFakeTimers()
})

describe('useDetachedModel', () => {
  test('should work', async () => {
    const count = defineModel({
      name: 'count',
      state: {
        value: 1,
      },
      actions: {
        add(payload: number = 1) {
          this.value += payload
        },
      },
    })
    const App = () => {
      const counter = useDetachedModel(count)

      return (
        <>
          <div id="value">{counter.value}</div>
          <button id="button" type="button" onClick={() => counter.add()}>
            add
          </button>
        </>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    expect(container.querySelector('#value')?.innerHTML).toEqual('1')
    await act(async () => {
      container
        .querySelector('#button')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#value')?.innerHTML).toEqual('2')
  })

  test('should ignore model name and stay isolated from named useModel', async () => {
    const named = defineModel({
      name: 'localCount',
      state: { value: 1 },
      actions: {
        add(payload: number = 1) {
          this.value += payload
        },
      },
    })

    const App = () => {
      const shared = useModel(named)
      const local = useDetachedModel(named)

      return (
        <>
          <div id="shared">{shared.value}</div>
          <button id="sharedButton" onClick={() => shared.add(2)}>
            add shared
          </button>
          <div id="local">{local.value}</div>
          <button id="localButton" onClick={() => local.add(3)}>
            add local
          </button>
        </>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    await act(async () => {
      container
        .querySelector('#sharedButton')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#shared')?.innerHTML).toEqual('3')
    expect(container.querySelector('#local')?.innerHTML).toEqual('1')

    await act(async () => {
      container
        .querySelector('#localButton')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#shared')?.innerHTML).toEqual('3')
    expect(container.querySelector('#local')?.innerHTML).toEqual('4')
  })

  describe('should always be isolation', () => {
    test('should isolation with named model', async () => {
      const App = () => {
        const counter = useModel(countModel)
        const loacalCounter = useDetachedModel(countModel)

        return (
          <>
            <div id="value">{counter.value}</div>
            <button id="button" type="button" onClick={() => counter.add(2)}>
              add
            </button>
            <div id="value1">{loacalCounter.value}</div>
            <button
              id="button1"
              type="button"
              onClick={() => loacalCounter.add(2)}
            >
              add1
            </button>
          </>
        )
      }

      const { container } = render(
        <DouraRoot>
          <App />
        </DouraRoot>
      )

      expect(container.querySelector('#value')?.innerHTML).toEqual('1')
      expect(container.querySelector('#value1')?.innerHTML).toEqual('1')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(container.querySelector('#value')?.innerHTML).toEqual('3')
      expect(container.querySelector('#value1')?.innerHTML).toEqual('1')
    })

    test('should isolation with another useModel', async () => {
      const App = () => {
        const counterA = useDetachedModel(countModel)
        const counterB = useDetachedModel(countModel)

        return (
          <>
            <div id="value">{counterA.value}</div>
            <button id="button" type="button" onClick={() => counterA.add(2)}>
              add
            </button>
            <div id="value1">{counterB.value}</div>
            <button id="button1" type="button" onClick={() => counterB.add(2)}>
              add1
            </button>
          </>
        )
      }

      const { container } = render(
        <DouraRoot>
          <App />
        </DouraRoot>
      )

      expect(container.querySelector('#value')?.innerHTML).toEqual('1')
      expect(container.querySelector('#value1')?.innerHTML).toEqual('1')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(container.querySelector('#value')?.innerHTML).toEqual('3')
      expect(container.querySelector('#value1')?.innerHTML).toEqual('1')
    })
  })

  describe('selector', () => {
    it('should work', async () => {
      const App = () => {
        const counter = useDetachedModel(
          countModel,
          (state, actions) => {
            return {
              value: state.value,
              test: state.test,
              ...actions,
            }
          },
          []
        )

        return (
          <>
            <div id="v">{counter.value}</div>
            <div id="t">{counter.test}</div>
            <button id="button" type="button" onClick={() => counter.add(2)}>
              add
            </button>
          </>
        )
      }

      const { container } = render(
        <DouraRoot>
          <App />
        </DouraRoot>
      )

      expect(container.querySelector('#v')?.innerHTML).toEqual('1')
      expect(container.querySelector('#t')?.innerHTML).toEqual('2')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(container.querySelector('#v')?.innerHTML).toEqual('3')
      expect(container.querySelector('#t')?.innerHTML).toEqual('4')
    })

    it('should render only sub props changed', async () => {
      const model = defineModel({
        name: 'model',
        state: {
          anObject: {
            value: 1,
          },
        },
        actions: {
          add() {
            this.anObject.value += 1
          },
        },
      })
      const App = () => {
        const m = useDetachedModel(
          model,
          (state, actions) => {
            return {
              anObject: state.anObject,
              ...actions,
            }
          },
          []
        )

        return (
          <>
            <div id="v">{m.anObject.value}</div>
            <button id="button" type="button" onClick={() => m.add()}>
              add
            </button>
          </>
        )
      }

      const { container } = render(
        <DouraRoot>
          <App />
        </DouraRoot>
      )

      expect(container.querySelector('#v')?.innerHTML).toEqual('1')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(container.querySelector('#v')?.innerHTML).toEqual('2')
    })

    it('should not work when return api directly', async () => {
      const App = () => {
        const counter = useDetachedModel(countModel, (s) => s, [])

        return (
          <>
            <div id="v">{counter.value}</div>
            <div id="t">{counter.test}</div>
          </>
        )
      }

      const { container } = render(
        <DouraRoot>
          <App />
        </DouraRoot>
      )

      expect(
        `detected that "self" is returned in view, it would cause unpected behavior`
      ).toHaveBeenWarned()
      expect(container.querySelector('#v')?.innerHTML).toEqual('1')
      expect(container.querySelector('#t')?.innerHTML).toEqual('2')
    })

    describe('ModelView cleanup on unmount', () => {
      // useDetachedModel creates a per-component doura() store internally.
      // We simulate this by creating our own store + useModelImpl, which is
      // the exact same code path useDetachedModel takes.
      function makeDetachedHook(store: ReturnType<typeof doura>) {
        return <
          ModelDef extends ModelDefinition<Model>,
          S extends Selector<ModelDef>,
        >(
          model: ModelDef,
          selector?: S,
          depends?: any[]
        ) => {
          return useModelImpl({ store }, model, selector, depends)
        }
      }

      test('should destroy selector ModelView when component unmounts', async () => {
        const localStore = doura()

        const Child = () => {
          const data = makeDetachedHook(localStore)(
            countModel,
            (s, actions) => ({ value: s.value, add: actions.add }),
            []
          )
          return <div>{data.value}</div>
        }

        const App = () => {
          const [show, setShow] = useState(false)
          return (
            <>
              <button id="toggle" onClick={() => setShow((s) => !s)}>
                toggle
              </button>
              {show && <Child />}
            </>
          )
        }

        // Pre-create model to capture baseline effects
        localStore.getModel(countModel)
        const internal = getInternal(localStore, countModel.$options.name)
        const baseline = internal.effectScope.effects.length

        const { container } = render(<App />)
        const toggle = () =>
          act(async () => {
            container
              .querySelector('#toggle')
              ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          })

        await toggle() // mount
        expect(internal.effectScope.effects.length).toBeGreaterThan(baseline)

        await toggle() // unmount
        expect(internal.effectScope.effects.length).toBe(baseline)
      })

      test('should not accumulate effects across mount/unmount cycles', async () => {
        const localStore = doura()

        const Child = () => {
          const data = makeDetachedHook(localStore)(
            countModel,
            (s, actions) => ({ value: s.value, add: actions.add }),
            []
          )
          return <div>{data.value}</div>
        }

        const App = () => {
          const [show, setShow] = useState(false)
          return (
            <>
              <button id="toggle" onClick={() => setShow((s) => !s)}>
                toggle
              </button>
              {show && <Child />}
            </>
          )
        }

        localStore.getModel(countModel)
        const internal = getInternal(localStore, countModel.$options.name)
        const baseline = internal.effectScope.effects.length

        const { container } = render(<App />)
        const toggle = () =>
          act(async () => {
            container
              .querySelector('#toggle')
              ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          })

        for (let i = 0; i < 10; i++) {
          await toggle() // mount
          await toggle() // unmount
        }

        expect(internal.effectScope.effects.length).toBe(baseline)
      })
    })
  })
})

describe('useModel (with name)', () => {
  describe('DouraRoot', () => {
    test('useModel(model) should use defineModel name option', async () => {
      const named = defineModel({
        name: 'implicitCount',
        state: {
          value: 1,
        },
        actions: {
          add(payload: number = 1) {
            this.value += payload
          },
        },
      })
      const App = () => {
        const counter = useModel(named)
        return (
          <>
            <div id="value">{counter.value}</div>
            <button id="button" type="button" onClick={() => counter.add()}>
              add
            </button>
          </>
        )
      }

      const { container } = render(
        <DouraRoot>
          <App />
        </DouraRoot>
      )

      expect(container.querySelector('#value')?.innerHTML).toEqual('1')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(container.querySelector('#value')?.innerHTML).toEqual('2')
    })

    test('DouraRoot should worked without props douraStore', async () => {
      const App = () => {
        const counter = useModel(countModel)
        return (
          <>
            <div id="value">{counter.value}</div>
            <button id="button" type="button" onClick={() => counter.add()}>
              add
            </button>
          </>
        )
      }

      const { container } = render(
        <DouraRoot>
          <App />
        </DouraRoot>
      )

      expect(container.querySelector('#value')?.innerHTML).toEqual('1')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(container.querySelector('#value')?.innerHTML).toEqual('2')
    })

    test('DouraRoot props douraStore could overwrite default douraStore', () => {
      const App = () => {
        const counter = useModel(countModel)
        return (
          <>
            <div id="value">{counter.value}</div>
          </>
        )
      }

      const douraStore = doura({
        initialState: {
          countModel: {
            value: 2,
          },
        },
      })

      const { container } = render(
        <DouraRoot store={douraStore}>
          <App />
        </DouraRoot>
      )

      expect(container.querySelector('#value')?.innerHTML).toEqual('2')
    })
  })

  test('model options name is required', async () => {
    const countModel = defineModel({
      name: 'countModel',
      state: {
        value: 1,
      },
      actions: {
        add(payload: number = 1) {
          this.value += payload
        },
      },
    })

    const App = () => {
      const counter = useModel({
        ...countModel,
        name: '',
      } as unknown as typeof countModel)
      return <div id="value">{counter.value}</div>
    }

    expect(() => {
      render(
        <DouraRoot>
          <App />
        </DouraRoot>
      )
    }).toThrow()
  })

  test('useModel(model) should throw when model has no name option', async () => {
    const unnamed = defineModel({
      state: {
        value: 1,
      },
    } as any)

    const App = () => {
      const counter: any = useModel(unnamed as any)
      return <div id="value">{counter.value}</div>
    }

    expect(() => {
      render(
        <DouraRoot>
          <App />
        </DouraRoot>
      )
    }).toThrow()
  })

  test('should throw if DouraRoot has not been found', async () => {
    const countModel = defineModel({
      name: 'countModel',
      state: {
        value: 1,
      },
      actions: {
        add(payload: number = 1) {
          this.value += payload
        },
      },
    })

    const App = () => {
      const counter = useModel(countModel)

      return (
        <>
          <div id="value">{counter.value}</div>
          <button id="button" type="button" onClick={() => counter.add()}>
            add
          </button>
        </>
      )
    }

    expect(() => {
      render(<App />)
    }).toThrow()
  })

  test('should return same ref', async () => {
    let ref1: any = null
    let ref2: any = null
    const App = () => {
      const counter = useModel(countModel)
      ref1 = counter
      return (
        <>
          <div id="value">{counter.value}</div>
          <button id="button" type="button" onClick={() => counter.add(1)}>
            add
          </button>
          <SubApp></SubApp>
        </>
      )
    }
    function SubApp() {
      const counter = useModel(countModel)
      ref2 = counter
      return <></>
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    expect(container.querySelector('#value')?.innerHTML).toEqual('1')

    expect(ref1).toBe(ref2)
    await act(async () => {
      container
        .querySelector('#button')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })

    expect(container.querySelector('#value')?.innerHTML).toEqual('2')
    expect(ref1).toBe(ref2)
  })

  // OPTIMIZE: return same ref for same selector
  test('should not return same ref (with selector)', async () => {
    let ref1: any = null
    let ref2: any = null
    const selector = (s: any, a: any) => {
      return { value: s.value, ...a }
    }
    const App = () => {
      const counter = useModel(countModel, selector)
      ref1 = counter
      return (
        <>
          <div id="value">{counter.value}</div>
          <button id="button" type="button" onClick={() => counter.add(1)}>
            add
          </button>
          <SubApp></SubApp>
        </>
      )
    }
    function SubApp() {
      const counter = useModel(countModel, selector)
      ref2 = counter
      return <></>
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    expect(container.querySelector('#value')?.innerHTML).toEqual('1')

    expect(ref1).not.toBe(ref2)
    await act(async () => {
      container
        .querySelector('#button')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })

    expect(container.querySelector('#value')?.innerHTML).toEqual('2')
    expect(ref1).not.toBe(ref2)
  })

  test("should keep data's state with component unmount or not", async () => {
    const SubApp = () => {
      const counter = useModel(countModel)

      return (
        <>
          <div id="state">{counter.value}</div>
          <button id="button" type="button" onClick={() => counter.add()}>
            add
          </button>
        </>
      )
    }

    const App = () => {
      const [toggle, setToggle] = React.useState(true)
      return (
        <>
          <button id="toggle" type="button" onClick={() => setToggle(!toggle)}>
            add
          </button>
          {toggle ? <SubApp /> : null}
        </>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    expect(container.querySelector('#state')?.innerHTML).toEqual('1')
    await act(async () => {
      container
        .querySelector('#button')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#state')?.innerHTML).toEqual('2')
    await act(async () => {
      container
        .querySelector('#toggle')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#state')?.innerHTML).toEqual(undefined)
    await act(async () => {
      container
        .querySelector('#toggle')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#state')?.innerHTML).toEqual('2')
  })

  describe('selector ModelView cleanup on unmount', () => {
    test('should destroy ModelView when component unmounts', async () => {
      const douraStore = doura()
      const { Provider, useSharedModel } = createContainer()

      // Instantiate the model before mounting the selector component
      // to capture the baseline effect count (model's own view effects).
      douraStore.getModel(countModel)
      const internal = getInternal(douraStore, countModel.$options.name)
      const baseline = internal.effectScope.effects.length

      const Child = () => {
        const data = useSharedModel(
          countModel,
          (s, actions) => ({ value: s.value, add: actions.add }),
          []
        )
        return <div>{data.value}</div>
      }

      const App = () => {
        const [show, setShow] = useState(false)
        return (
          <>
            <button id="toggle" onClick={() => setShow((s) => !s)}>
              toggle
            </button>
            {show && <Child />}
          </>
        )
      }

      const { container } = render(
        <Provider store={douraStore}>
          <App />
        </Provider>
      )
      const toggle = () =>
        act(async () => {
          container
            .querySelector('#toggle')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })

      await toggle() // mount Child — adds selector view effect
      expect(internal.effectScope.effects.length).toBeGreaterThan(baseline)

      await toggle() // unmount Child — selector view effect should be cleaned up
      expect(internal.effectScope.effects.length).toBe(baseline)
    })

    test('should not accumulate effects across mount/unmount cycles', async () => {
      const douraStore = doura()
      const { Provider, useSharedModel } = createContainer()

      douraStore.getModel(countModel)
      const internal = getInternal(douraStore, countModel.$options.name)
      const baseline = internal.effectScope.effects.length

      const Child = () => {
        const data = useSharedModel(
          countModel,
          (s, actions) => ({ value: s.value, add: actions.add }),
          []
        )
        return <div>{data.value}</div>
      }

      const App = () => {
        const [show, setShow] = useState(false)
        return (
          <>
            <button id="toggle" onClick={() => setShow((s) => !s)}>
              toggle
            </button>
            {show && <Child />}
          </>
        )
      }

      const { container } = render(
        <Provider store={douraStore}>
          <App />
        </Provider>
      )
      const toggle = () =>
        act(async () => {
          container
            .querySelector('#toggle')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })

      for (let i = 0; i < 10; i++) {
        await toggle() // mount
        await toggle() // unmount
      }

      // No orphaned selector effects should remain
      expect(internal.effectScope.effects.length).toBe(baseline)
    })
  })
})

// useDetachedModel does not call store.destroy() on unmount.
// The detached store is created via doura() with no plugins, so there are no
// external resources (DevTools connections, plugin subscriptions) to clean up.
// All internal resources (draft watchers, effect scope, model state) are only
// reachable through the component's useRef and will be GC'd after unmount.
// View cleanup is handled by useModelWithSelector's own useEffect.

describe('useStaticModel', () => {
  test('model options name should not be empty', async () => {
    const count = defineModel({
      name: 'count',
      state: {
        value: 1,
      },
      actions: {
        add(payload: number = 1) {
          this.value += payload
        },
      },
    })

    const App1 = () => {
      const counter = useStaticModel({
        ...count,
        name: '',
      } as unknown as typeof count)
      return <div id="value">{counter.value}</div>
    }
    const App2 = () => {
      const counter = useStaticModel(count)
      return <div id="value">{counter.value}</div>
    }

    expect(() => {
      render(
        <DouraRoot>
          <App1 />
        </DouraRoot>
      )
    }).toThrow()
    const { container } = render(
      <DouraRoot>
        <App2 />
      </DouraRoot>
    )
    expect(container.querySelector('#value')?.innerHTML).toEqual('1')
  })

  test('should throw if DouraRoot has not been found', async () => {
    const count = defineModel({
      name: 'count',
      state: {
        value: 1,
      },
      actions: {
        add(payload: number = 1) {
          this.value += payload
        },
      },
    })

    const App = () => {
      const counter = useStaticModel(count)

      return (
        <>
          <div id="value">{counter.value}</div>
          <button id="button" type="button" onClick={() => counter.add()}>
            add
          </button>
        </>
      )
    }

    expect(() => {
      render(<App />)
    }).toThrow()
  })

  test('should state keep same ref in one component', async () => {
    let stateRef: any
    let stateRef1: any

    const StaticApp = () => {
      const counter = useStaticModel(countModel)
      const [_, setValue] = React.useState(false)

      if (!stateRef) {
        stateRef = counter
      }

      stateRef1 = counter

      return (
        <>
          <div id="state">{counter.value}</div>
          <button
            id="add"
            type="button"
            onClick={() => {
              counter.add()
              setValue(true)
            }}
          >
            add
          </button>
        </>
      )
    }

    const { container } = render(
      <DouraRoot>
        <StaticApp />
      </DouraRoot>
    )

    await act(async () => {
      container
        .querySelector('#add')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })

    expect(stateRef === stateRef1).toBeTruthy()
  })
})

describe('StrictMode: useModelWithSelector view lifecycle', () => {
  // React 18 StrictMode double-invokes render, effects, and cleanup in dev.
  // The sequence for a mount is:
  //   1. render (useMemo runs → creates view1)
  //   2. effect setup
  //   3. effect cleanup (StrictMode simulated unmount)
  //   4. render (useMemo skipped — deps unchanged → reuses view1)
  //   5. effect setup
  //
  // The bug: step 3 calls selectorRef.current.destroy() which stops view1's
  // ReactiveEffect. But step 4 reuses the same destroyed view1 from useMemo
  // cache. The component then holds a dead view that never updates.

  test('selector view should remain reactive after StrictMode double-mount', async () => {
    const douraStore = doura()
    const { Provider, useSharedModel } = createContainer()

    const Child = () => {
      const data = useSharedModel(
        countModel,
        (s, actions) => ({ value: s.value, add: actions.add }),
        []
      )
      return (
        <>
          <div id="value">{data.value}</div>
          <button id="add" onClick={() => data.add(1)}>
            add
          </button>
        </>
      )
    }

    const { container } = render(
      <StrictMode>
        <Provider store={douraStore}>
          <Child />
        </Provider>
      </StrictMode>
    )

    // Initial render should show the correct value
    expect(container.querySelector('#value')?.textContent).toBe('1')

    // Mutate state — if the view is alive, the component should re-render
    await act(async () => {
      container
        .querySelector('#add')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })

    // This fails if the view was destroyed by StrictMode cleanup and never
    // recreated: the component stays frozen at the stale value.
    expect(container.querySelector('#value')?.textContent).toBe('2')
  })

  test('useDetachedModel with selector should remain reactive under StrictMode', async () => {
    const Child = () => {
      const data = useDetachedModel(
        countModel,
        (s: any, actions: any) => ({ value: s.value, add: actions.add }),
        []
      )
      return (
        <>
          <div id="value">{data.value}</div>
          <button id="add" onClick={() => data.add(1)}>
            add
          </button>
        </>
      )
    }

    const { container } = render(
      <StrictMode>
        <DouraRoot>
          <Child />
        </DouraRoot>
      </StrictMode>
    )

    expect(container.querySelector('#value')?.textContent).toBe('1')

    await act(async () => {
      container
        .querySelector('#add')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })

    expect(container.querySelector('#value')?.textContent).toBe('2')
  })
})

// Tests below are merged from createUseModel.test.tsx
describe('useModelImpl', () => {
  let douraStore: ReturnType<typeof doura>
  let useTestModel: UseSharedModel
  let useTestStaticModel: UseStaticModel

  beforeEach(() => {
    douraStore = doura()
    useTestModel = <
      ModelDef extends ModelDefinition<Model>,
      S extends Selector<ModelDef>,
    >(
      model: ModelDef,
      selector?: S,
      depends?: any[]
    ) => {
      return useModelImpl({ store: douraStore }, model, selector, depends)
    }
    useTestStaticModel = <ModelDef extends ModelDefinition<Model>>(
      model: ModelDef
    ) => {
      return useStaticModelImpl({ store: douraStore }, model)
    }
  })

  test('could access state and view', () => {
    const model = defineModel({
      name: 'model',
      state: { value: 1 },
      views: {
        test() {
          return this.value * 2
        },
      },
    })

    const App = () => {
      const store = useTestModel(model)

      return (
        <>
          <div id="v">{store.value}</div>
          <div id="t">{store.test}</div>
        </>
      )
    }
    const { container } = render(<App />)

    expect(container.querySelector('#v')?.innerHTML).toEqual('1')
    expect(container.querySelector('#t')?.innerHTML).toEqual('2')
  })

  describe('should rerender when state changed', () => {
    test('change state by doura reducer', async () => {
      const App = () => {
        const store = useTestModel(countModel)

        return (
          <>
            <div id="value">{store.value}</div>
            <button id="button" type="button" onClick={() => store.add()}>
              add
            </button>
          </>
        )
      }

      const { container } = render(<App />)
      expect(container.querySelector('#value')?.innerHTML).toEqual('1')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(container.querySelector('#value')?.innerHTML).toEqual('2')
    })

    test('change state by doura action', async () => {
      const App = () => {
        const counter = useTestModel(countModel)

        return (
          <>
            <div id="value">{counter.value}</div>
            <button
              id="button"
              type="button"
              onClick={() => counter.asyncAdd(2)}
            >
              add
            </button>
          </>
        )
      }

      const { container } = render(<App />)
      expect(container.querySelector('#value')?.innerHTML).toEqual('1')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        jest.runAllTimers()
      })
      expect(container.querySelector('#value')?.innerHTML).toEqual('3')
    })

    test('should rerender when depends state changed', async () => {
      const newModel = defineModel({
        name: 'newModel',
        state: { value: 0 },
        models: [countModel],
        actions: {
          add(payload: number = 1) {
            this.value += payload
          },
          async asyncAdd() {
            await this.countModel.asyncAdd(1)
            this.add(this.countModel.value)
          },
        },
        views: {
          test() {
            return this.countModel.value * 2
          },
        },
      })

      const App = () => {
        const store = useTestModel(
          newModel,
          function (s, actions) {
            return {
              v: s.value,
              t: s.test,
              asyncAdd: actions.asyncAdd,
            }
          },
          []
        )

        return (
          <>
            <div id="v">{store.v}</div>
            <div id="t">{store.t}</div>
            <button id="button" type="button" onClick={() => store.asyncAdd()}>
              add
            </button>
          </>
        )
      }

      const { container } = render(<App />)

      expect(container.querySelector('#v')?.innerHTML).toEqual('0')
      expect(container.querySelector('#t')?.innerHTML).toEqual('2')
      await act(async () => {
        container
          .querySelector('#button')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      await act(async () => {
        jest.runAllTimers()
      })
      expect(container.querySelector('#v')?.innerHTML).toEqual('2')
      expect(container.querySelector('#t')?.innerHTML).toEqual('4')
    })
  })

  test('should only consume model once', async () => {
    const App = () => {
      const [state, setState] = React.useState(1)
      const counter = useTestModel(
        defineModel({
          name: 'counter',
          state: {
            count: state,
          },
          actions: {
            add() {
              this.count += 1
            },
          },
        })
      )

      return (
        <>
          <button id="state" onClick={() => setState((s) => s + 1)}>
            {state}
          </button>
          <button id="count" onClick={() => counter.add()}>
            {counter.count}
          </button>
        </>
      )
    }
    const { container } = render(<App />)

    expect(container.querySelector('#count')!.textContent).toEqual('1')
    await act(async () => {
      container
        .querySelector('#state')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#state')!.textContent).toEqual('2')
    expect(container.querySelector('#count')!.textContent).toEqual('1')
  })

  test('should only consume model once with selector', async () => {
    const fn = jest.fn()
    const countSelector = (s: any, actions: any) => {
      fn()
      return {
        count: s.count,
        ...actions,
      }
    }
    const App = () => {
      const [state, setState] = React.useState(1)
      const counter = useTestModel(
        defineModel({
          name: 'counter',
          state: {
            count: state,
          },
          actions: {
            add() {
              this.count += 1
            },
          },
        }),
        countSelector
      )

      return (
        <>
          <button id="state" onClick={() => setState((s) => s + 1)}>
            {state}
          </button>
          <button id="count" onClick={() => counter.add()}>
            {counter.count}
          </button>
        </>
      )
    }
    const { container } = render(<App />)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#count')!.textContent).toEqual('1')
    await act(async () => {
      container
        .querySelector('#state')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#state')!.textContent).toEqual('2')
    expect(container.querySelector('#count')!.textContent).toEqual('1')
  })

  test('should recompute shared model when model name changes', async () => {
    const firstModel = defineModel({
      name: 'firstSharedModel',
      state: { value: 'first' },
      actions: {},
    })
    const secondModel = defineModel({
      name: 'secondSharedModel',
      state: { value: 'second' },
      actions: {},
    })

    const App = () => {
      const [useSecond, setUseSecond] = React.useState(false)
      const store = useTestModel(useSecond ? secondModel : firstModel)

      return (
        <>
          <button id="switch" onClick={() => setUseSecond(true)}>
            switch
          </button>
          <div id="value">{store.value}</div>
        </>
      )
    }

    const { container } = render(<App />)

    expect(container.querySelector('#value')!.textContent).toEqual('first')
    await act(async () => {
      container
        .querySelector('#switch')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#value')!.textContent).toEqual('second')
  })

  describe('selector', () => {
    const countModel = defineModel({
      name: 'count',
      state: {
        count: 1,
      },
      actions: {
        add() {
          this.count += 1
        },
      },
    })

    describe('no dependencies params', () => {
      test('global selector', async () => {
        const fn = jest.fn()
        const countSelector = (
          s: ModelAPI<typeof countModel>,
          actions: ModelActions<typeof countModel>
        ) => {
          fn()
          return { count: s.count, add: actions.add }
        }
        const App = () => {
          const [state, setState] = React.useState(0)
          const counter = useTestModel(countModel, countSelector)

          return (
            <>
              <button id="state" onClick={() => setState((s) => s + 1)}>
                {state}
              </button>
              <button id="count" onClick={() => counter.add()}>
                {counter.count}
              </button>
            </>
          )
        }
        const { container } = render(<App />)

        expect(fn).toHaveBeenCalledTimes(1)
        expect(container.querySelector('#count')!.textContent).toEqual('1')
        await act(async () => {
          container
            .querySelector('#state')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          await nextTick()
        })
        expect(fn).toHaveBeenCalledTimes(1)
        await act(async () => {
          container
            .querySelector('#count')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          await nextTick()
        })
        expect(fn).toHaveBeenCalledTimes(2)
        expect(container.querySelector('#count')!.textContent).toEqual('2')
      })

      test('inline selector', async () => {
        const fn = jest.fn()
        const App = () => {
          const [state, setState] = React.useState(0)
          const counter = useTestModel(countModel, (s, actions) => {
            fn()
            return { count: s.count, add: actions.add }
          })

          return (
            <>
              <button id="state" onClick={() => setState((s) => s + 1)}>
                {state}
              </button>
              <button id="count" onClick={() => counter.add()}>
                {counter.count}
              </button>
            </>
          )
        }
        const { container } = render(<App />)

        expect(fn).toHaveBeenCalledTimes(1)
        expect(container.querySelector('#count')!.textContent).toEqual('1')
        await act(async () => {
          container
            .querySelector('#state')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        expect(fn).toHaveBeenCalledTimes(2)
        expect(container.querySelector('#count')!.textContent).toEqual('1')
        await act(async () => {
          container
            .querySelector('#count')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        expect(fn).toHaveBeenCalledTimes(4)
        expect(container.querySelector('#count')!.textContent).toEqual('2')
      })
    })

    test('depends []', async () => {
      const fn = jest.fn()
      const App = () => {
        const [state, setState] = React.useState(0)
        const counter = useTestModel(
          countModel,
          (s, actions) => {
            fn()
            return { count: s.count, add: actions.add }
          },
          []
        )

        return (
          <>
            <button id="state" onClick={() => setState((s) => s + 1)}>
              {state}
            </button>
            <button id="count" onClick={() => counter.add()}>
              {counter.count}
            </button>
          </>
        )
      }
      const { container } = render(<App />)

      expect(fn).toHaveBeenCalledTimes(1)
      await act(async () => {
        container
          .querySelector('#state')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(fn).toHaveBeenCalledTimes(1)
      await act(async () => {
        container
          .querySelector('#count')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(fn).toHaveBeenCalledTimes(2)
      expect(container.querySelector('#count')!.textContent).toEqual('2')
    })

    it('should be called after deps changes', async () => {
      const fn = jest.fn()
      const SybApp = (props: { prop1: number; prop2: number }) => {
        const count = useTestModel(
          countModel,
          function (stateAndViews) {
            fn()
            return stateAndViews.count + props.prop2
          },
          [props.prop2]
        )

        return <div id="value">{count}</div>
      }
      const App = () => {
        const [state1, setState1] = React.useState(0)
        const [state2, setState2] = React.useState(0)

        return (
          <>
            <button id="btn1" onClick={() => setState1((s) => s + 1)}>
              {state1}
            </button>
            <button id="btn2" onClick={() => setState2((s) => s + 1)}>
              {state2}
            </button>
            <SybApp prop1={state1} prop2={state2}></SybApp>
          </>
        )
      }
      const { container } = render(<App />)

      expect(fn).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#value')!.textContent).toEqual('1')
      await act(async () => {
        container
          .querySelector('#btn1')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(fn).toHaveBeenCalledTimes(1)
      await act(async () => {
        container
          .querySelector('#btn2')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(fn).toHaveBeenCalledTimes(2)
      expect(container.querySelector('#value')!.textContent).toEqual('2')
    })

    test('should clear prev selector cache', async () => {
      const selector1 = jest.fn()
      const selector2 = jest.fn()
      const countSelector1 = function (_: any, actions: any) {
        selector1()
        return {
          value: 1,
          add: actions.add,
        }
      }
      const countSelector2 = function (_: any, actions: any) {
        selector2()
        return {
          value: 2,
          add: actions.add,
        }
      }
      const App = () => {
        let [selectorSwitch, setSwitch] = React.useState(true)
        const counter = useTestModel(
          countModel,
          selectorSwitch ? countSelector1 : countSelector2
        )

        return (
          <>
            <button id="switch" onClick={() => setSwitch((s) => !s)}>
              {selectorSwitch}
            </button>
            <button id="value" onClick={() => counter.add()}>
              {counter.value}
            </button>
          </>
        )
      }

      const { container } = render(<App />)

      // countSelector1 run and cache countSelector1
      expect(selector1).toHaveBeenCalledTimes(1)
      expect(selector2).toHaveBeenCalledTimes(0)
      expect(container.querySelector('#value')?.textContent).toEqual('1')
      await act(async () => {
        container
          .querySelector('#count')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      // cache worked, use countSelector1 cache, not computed
      expect(selector1).toHaveBeenCalledTimes(1)
      expect(selector2).toHaveBeenCalledTimes(0)
      expect(container.querySelector('#value')?.innerHTML).toEqual('1')

      // drop countSelector1 cache,  countSelector2 run and cache countSelector2
      await act(async () => {
        container
          .querySelector('#switch')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(selector1).toHaveBeenCalledTimes(1)
      expect(selector2).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#value')?.textContent).toEqual('2')
      await act(async () => {
        container
          .querySelector('#count')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(selector1).toHaveBeenCalledTimes(1)
      expect(selector2).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#value')?.textContent).toEqual('2')

      // drop countSelector2 cache,  countSelector1 run and cache countSelector1
      await act(async () => {
        container
          .querySelector('#switch')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(selector1).toHaveBeenCalledTimes(2)
      expect(selector2).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#value')?.textContent).toEqual('1')
      await act(async () => {
        container
          .querySelector('#count')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
      })
      expect(selector1).toHaveBeenCalledTimes(2)
      expect(selector2).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#value')?.textContent).toEqual('1')
    })

    test('should warn if changed state in a selector', () => {
      const App = () => {
        const [_state] = useTestModel(countModel, (stateAndViews: any) => {
          stateAndViews.count = 1
          return stateAndViews.count
        })
        return null
      }
      expect(() => {
        render(<App />)
      }).toThrow()
      expect(
        'Attempting to change state "count". State are readonly in "views"'
      ).toHaveBeenWarned()
    })
  })

  test('could trigger component render outside of component', async () => {
    let AppRenderCount = 0

    function App() {
      AppRenderCount += 1
      const { value } = useTestModel(countModel)

      return (
        <>
          <div id="value">{`${value}`}</div>
        </>
      )
    }

    render(<App />)
    expect(AppRenderCount).toBe(1)

    await act(async () => {
      const countStore = douraStore.getModel(countModel)
      countStore.add()
      await nextTick()
    })

    expect(AppRenderCount).toBe(2)
  })

  test('render should be batched when update occurs out of react lifecycle', async () => {
    let renderCount = 0

    const App = () => {
      renderCount++
      const [index, setIndex] = React.useState(0)
      const [index1, setIndex1] = React.useState(0)
      const modelInstance = douraStore.getModel(countModel)

      React.useEffect(() => {
        const unsub1 = modelInstance.$subscribe(() => {
          setIndex(1)
        })
        const unsub2 = modelInstance.$subscribe(() => {
          setIndex1(1)
        })
        return () => {
          unsub1()
          unsub2()
        }
      }, [modelInstance])

      return (
        <>
          <div id="value">{index}</div>
          <div id="value1">{index1}</div>
        </>
      )
    }

    const { container } = render(<App />)

    expect(renderCount).toBe(1)
    expect(container.querySelector('#value')?.innerHTML).toEqual('0')
    expect(container.querySelector('#value1')?.innerHTML).toEqual('0')
    await act(async () => {
      douraStore.getModel(countModel).add()
      await nextTick()
    })
    // Both setState calls should be batched into a single re-render by React 18
    expect(renderCount).toBe(2)
    expect(container.querySelector('#value')?.innerHTML).toEqual('1')
    expect(container.querySelector('#value1')?.innerHTML).toEqual('1')
  })

  test('should render with newest state even update state during render', async () => {
    let firstRender = true
    const App = () => {
      const { value, add } = useTestModel(countModel)

      if (firstRender) {
        firstRender = false
        add(1)
      }

      return <div id="value">{value}</div>
    }

    const { container } = render(<App />)

    await act(async () => {
      await nextTick()
    })

    expect(container.querySelector('#value')!.textContent).toEqual('2')
  })
})

describe('useStaticModelImpl', () => {
  let douraStore: ReturnType<typeof doura>
  let useTestStaticModel: UseStaticModel

  beforeEach(() => {
    douraStore = doura()
    useTestStaticModel = <ModelDef extends ModelDefinition<Model>>(
      model: ModelDef
    ) => {
      return useStaticModelImpl({ store: douraStore }, model)
    }
  })

  test('could access state and view', () => {
    const model = defineModel({
      name: 'model',
      state: { value: 1 },
      views: {
        test() {
          return this.value * 2
        },
      },
    })

    const App = () => {
      const state = useTestStaticModel(model)

      return (
        <>
          <div id="v">{state.value}</div>
          <div id="t">{state.test}</div>
        </>
      )
    }
    const { container } = render(<App />)

    expect(container.querySelector('#v')?.innerHTML).toEqual('1')
    expect(container.querySelector('#t')?.innerHTML).toEqual('2')
  })

  test('state updated, but component should not rendered', async () => {
    let renderTime = 0
    let currentCount = 0

    const App = () => {
      renderTime += 1

      const store = useTestStaticModel(countModel)

      currentCount = store.value

      return (
        <>
          <div id="state">{store.value}</div>
          <button id="add" type="button" onClick={() => store.add()}>
            add
          </button>
          <button
            id="updateCount"
            type="button"
            onClick={() => {
              currentCount = store.value
            }}
          >
            updateCount
          </button>
        </>
      )
    }

    const { container } = render(<App />)

    expect(renderTime).toBe(1)
    expect(currentCount).toBe(1)

    await act(async () => {
      container
        .querySelector('#add')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })

    expect(renderTime).toBe(1)
    expect(currentCount).toBe(1)

    await act(async () => {
      container
        .querySelector('#updateCount')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(currentCount).toBe(2)
  })

  test('should render with newest state even update state during render', () => {
    let firstRender = true
    const App = () => {
      const store = useTestStaticModel(countModel)

      if (firstRender) {
        firstRender = false
        store.add(1)
      }

      return <div id="value">{store.value}</div>
    }

    const { container } = render(<App />)
    expect(container.querySelector('#value')!.textContent).toEqual('2')
  })

  test('should recompute static model when model name changes', () => {
    const firstModel = defineModel({
      name: 'firstStaticModel',
      state: { value: 'first' },
      actions: {},
    })
    const secondModel = defineModel({
      name: 'secondStaticModel',
      state: { value: 'second' },
      actions: {},
    })

    const App = () => {
      const [useSecond, setUseSecond] = React.useState(false)
      const store = useTestStaticModel(useSecond ? secondModel : firstModel)

      return (
        <>
          <button id="switch" onClick={() => setUseSecond(true)}>
            switch
          </button>
          <div id="value">{store.value}</div>
        </>
      )
    }

    const { container } = render(<App />)

    expect(container.querySelector('#value')!.textContent).toEqual('first')
    act(() => {
      container
        .querySelector('#switch')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#value')!.textContent).toEqual('second')
  })
})

describe('useModelImpl: dynamic selector presence', () => {
  let douraStore: ReturnType<typeof doura>
  let useTestModel: UseSharedModel

  beforeEach(() => {
    douraStore = doura()
    useTestModel = <
      ModelDef extends ModelDefinition<Model>,
      S extends Selector<ModelDef>,
    >(
      model: ModelDef,
      selector?: S,
      depends?: any[]
    ) => {
      return useModelImpl({ store: douraStore }, model, selector, depends)
    }
  })

  test('should warn in dev when selector presence changes between renders', () => {
    const model = defineModel({
      name: 'model',
      state: { value: 1 },
      actions: {},
    })

    const App = ({ sel }: { sel?: (s: any) => any }) => {
      ;(useTestModel as any)(model, sel, sel ? [] : undefined)
      return <div />
    }

    // First render: no selector
    const { rerender } = render(<App />)

    // Second render: with selector — presence changed, should warn
    rerender(<App sel={(s: any) => s.value} />)
    expect(
      'useModel selector presence changed between renders. A component should always use a selector or never use one.'
    ).toHaveBeenWarned()
  })
})

describe('useModelImpl: selector depends stability', () => {
  let douraStore: ReturnType<typeof doura>
  let useTestModel: UseSharedModel

  beforeEach(() => {
    douraStore = doura()
    useTestModel = <
      ModelDef extends ModelDefinition<Model>,
      S extends Selector<ModelDef>,
    >(
      model: ModelDef,
      selector?: S,
      depends?: any[]
    ) => {
      return useModelImpl({ store: douraStore }, model, selector, depends)
    }
  })

  test('should recreate ModelView when depends values change', async () => {
    const model = defineModel({
      name: 'model',
      state: {
        items: { a: 1, b: 2, c: 3 },
      },
      actions: {
        set(key: string, value: number) {
          ;(this.items as any)[key] = value
        },
      },
    })

    const App = ({ filterKey }: { filterKey: string }) => {
      const data = useTestModel(
        model,
        (s) => {
          return (s.items as any)[filterKey]
        },
        [filterKey]
      )

      return <div id="value">{data}</div>
    }

    const { container, rerender } = render(<App filterKey="a" />)
    expect(container.querySelector('#value')!.textContent).toEqual('1')

    // Change the depends value — selector should re-create with new filterKey
    rerender(<App filterKey="b" />)
    expect(container.querySelector('#value')!.textContent).toEqual('2')

    // Change again
    rerender(<App filterKey="c" />)
    expect(container.querySelector('#value')!.textContent).toEqual('3')
  })

  test('should handle depends array length change without crashing', async () => {
    const model = defineModel({
      name: 'model',
      state: { x: 1, y: 2 },
      actions: {},
    })

    const App = ({ keys }: { keys: string[] }) => {
      const data = useTestModel(
        model,
        (s) => {
          return keys.map((k) => (s as any)[k]).join(',')
        },
        keys
      )

      return <div id="value">{data}</div>
    }

    // Start with 1 dep
    const { container, rerender } = render(<App keys={['x']} />)
    expect(container.querySelector('#value')!.textContent).toEqual('1')

    // Change to 2 deps — different length!
    rerender(<App keys={['x', 'y']} />)
    expect(container.querySelector('#value')!.textContent).toEqual('1,2')

    // Back to 1 dep
    rerender(<App keys={['y']} />)
    expect(container.querySelector('#value')!.textContent).toEqual('2')
  })
})
