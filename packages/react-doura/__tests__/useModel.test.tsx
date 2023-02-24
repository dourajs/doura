import React from 'react'
import { render, act } from '@testing-library/react'
import { doura, defineModel, nextTick } from 'doura'
import { DouraRoot, useModel, useStaticModel } from '../src/useModel'
import { countModel } from './models'

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
      expect(container.querySelector('#v')?.innerHTML).toEqual('')
      expect(container.querySelector('#t')?.innerHTML).toEqual('')
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
