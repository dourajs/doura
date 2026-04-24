import React, { StrictMode, useState } from 'react'
import { render, act } from '@testing-library/react'
import { doura, defineModel, nextTick, AnyModel, Selector } from 'doura'
import { DouraRoot, useModel, useStaticModel } from '../src/useModel'
import { createContainer } from '../src/createContainer'
import { createUseModel } from '../src/createUseModel'
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

describe('useModel (without name)', () => {
  test('should work', async () => {
    const count = defineModel({
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
      const counter = useModel(count)

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

  describe('should always be isolation', () => {
    test('should isolation with named model', async () => {
      const App = () => {
        const counter = useModel('count', countModel)
        const loacalCounter = useModel(countModel)

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
        const counterA = useModel(countModel)
        const counterB = useModel(countModel)

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
        const counter = useModel(
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
        const m = useModel(
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
        const counter = useModel(countModel, (s) => s, [])

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
      // Anonymous useModel creates a per-component doura() store internally.
      // We simulate this by creating our own store + createUseModel, which is
      // the exact same code path useAnonymousModel takes.
      const ANONYMOUS_MODEL_NAME = 'anonymous model'

      function makeAnonymousHook(store: ReturnType<typeof doura>) {
        return <IModel extends AnyModel, S extends Selector<IModel>>(
          model: IModel,
          selector?: S,
          depends?: any[]
        ) => {
          return React.useMemo(() => createUseModel(store), [store])(
            ANONYMOUS_MODEL_NAME,
            model,
            selector,
            depends
          )
        }
      }

      test('should destroy selector ModelView when component unmounts', async () => {
        const localStore = doura()

        const Child = () => {
          const data = makeAnonymousHook(localStore)(
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
        localStore.getModel(ANONYMOUS_MODEL_NAME, countModel)
        const internal = getInternal(localStore, ANONYMOUS_MODEL_NAME)
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
        // View destruction is deferred via microtask
        await Promise.resolve()
        expect(internal.effectScope.effects.length).toBe(baseline)
      })

      test('should not accumulate effects across mount/unmount cycles', async () => {
        const localStore = doura()

        const Child = () => {
          const data = makeAnonymousHook(localStore)(
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

        localStore.getModel(ANONYMOUS_MODEL_NAME, countModel)
        const internal = getInternal(localStore, ANONYMOUS_MODEL_NAME)
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
          // View destruction is deferred via microtask
          await Promise.resolve()
        }

        expect(internal.effectScope.effects.length).toBe(baseline)
      })
    })
  })
})

describe('useModel (with name)', () => {
  describe('DouraRoot', () => {
    test('DouraRoot should worked without props douraStore', async () => {
      const App = () => {
        const counter = useModel('count', countModel)
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
        const counter = useModel('count', countModel)
        return (
          <>
            <div id="value">{counter.value}</div>
          </>
        )
      }

      const douraStore = doura({
        initialState: {
          count: {
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

  test('name should not be empty', async () => {
    const countModel = defineModel({
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
      const counter = useModel('', countModel)
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
      const counter = useModel('count', countModel)

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
      const counter = useModel('count', countModel)
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
      const counter = useModel('count', countModel)
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
      const counter = useModel('count', countModel, selector)
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
      const counter = useModel('count', countModel, selector)
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
      const counter = useModel('count', countModel)

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
      douraStore.getModel('count', countModel)
      const internal = getInternal(douraStore, 'count')
      const baseline = internal.effectScope.effects.length

      const Child = () => {
        const data = useSharedModel(
          'count',
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
      // View destruction is deferred via microtask
      await Promise.resolve()
      expect(internal.effectScope.effects.length).toBe(baseline)
    })

    test('should not accumulate effects across mount/unmount cycles', async () => {
      const douraStore = doura()
      const { Provider, useSharedModel } = createContainer()

      douraStore.getModel('count', countModel)
      const internal = getInternal(douraStore, 'count')
      const baseline = internal.effectScope.effects.length

      const Child = () => {
        const data = useSharedModel(
          'count',
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
        // View destruction is deferred via microtask
        await Promise.resolve()
      }

      // No orphaned selector effects should remain
      expect(internal.effectScope.effects.length).toBe(baseline)
    })
  })
})

describe('useAnonymousModel store cleanup on unmount', () => {
  test('should destroy internally-created doura store when component unmounts', async () => {
    // Spy on the doura factory to capture the store instance it creates.
    const douraModule = require('doura')
    const originalDoura = douraModule.doura
    let capturedStore: any = null
    const douraFactory = jest
      .spyOn(douraModule, 'doura')
      .mockImplementation((...args: any[]) => {
        capturedStore = originalDoura(...args)
        return capturedStore
      })

    const model = defineModel({
      state: { value: 1 },
      actions: {
        add() {
          this.value += 1
        },
      },
    })

    const Child = () => {
      const data = useModel(model)
      return <div>{data.value}</div>
    }

    const App = () => {
      const [show, setShow] = useState(true)
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
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    // The anonymous model should have created a store
    expect(capturedStore).not.toBeNull()
    const destroySpy = jest.spyOn(capturedStore, 'destroy')

    // Unmount the Child component
    await act(async () => {
      container
        .querySelector('#toggle')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Store destruction is deferred via microtask to survive StrictMode's
    // simulated unmount-remount cycle. Flush the microtask.
    await Promise.resolve()

    // The internally-created store should be destroyed on unmount
    expect(destroySpy).toHaveBeenCalledTimes(1)

    douraFactory.mockRestore()
  })
})

describe('useStaticModel', () => {
  test('name should not be empty', async () => {
    const count = defineModel({
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
      const counter = useStaticModel(undefined as any, count)
      return <div id="value">{counter.value}</div>
    }
    const App2 = () => {
      const counter = useStaticModel('', count)
      return <div id="value">{counter.value}</div>
    }

    expect(() => {
      render(
        <DouraRoot>
          <App1 />
        </DouraRoot>
      )
    }).toThrow()
    expect(() => {
      render(
        <DouraRoot>
          <App2 />
        </DouraRoot>
      )
    }).toThrow()
  })

  test('should throw if DouraRoot has not been found', async () => {
    const count = defineModel({
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
      const counter = useStaticModel('count', count)

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
      const counter = useStaticModel('count', countModel)
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
        'count',
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

  test('anonymous useModel with selector should remain reactive under StrictMode', async () => {
    const Child = () => {
      const data = useModel(
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
