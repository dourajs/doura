import React from 'react'
import { render, act } from '@testing-library/react'
import { defineModel, doura, Plugin, nextTick } from 'doura'
import {
  createContainer,
  DouraRoot,
  useRootStaticModel,
  useRootModel,
} from '../src/index'

import { countModel } from './models/index'

jest.useFakeTimers()

beforeEach(() => {
  process.env.NODE_ENV = 'development'
})

describe('createContainer', () => {
  test('createContainer should return DouraRoot and useSharedModel, useRootStaticModel', () => {
    const {
      Provider: _Provider,
      useSharedModel: _useSharedModel,
      useStaticModel: _useStaticModel,
    } = createContainer()

    expect(_Provider).toBeTruthy()
    expect(_useSharedModel).toBeTruthy()
    expect(_useStaticModel).toBeTruthy()
  })

  test('createContainer should accept options of doura', () => {
    const onInit = jest.fn()
    const plugin: Plugin = () => {
      return {
        onInit,
      }
    }

    let initialState = {}

    const { Provider: LocalProvider, useSharedModel } = createContainer({
      initialState,
      plugins: [[plugin, {}]],
    })

    const SubApp = () => {
      const _ignore = useSharedModel('count', countModel)

      return null
    }

    render(
      <LocalProvider>
        <SubApp />
      </LocalProvider>
    )

    expect(onInit).toHaveBeenCalled()
  })

  test('Local DouraRoot and useSharedModel should work', async () => {
    const { Provider: LocalProvider, useSharedModel } = createContainer()

    const SubApp = () => {
      const counter = useSharedModel('count', countModel)

      return (
        <>
          <div id="state">{counter.value}</div>
          <button id="button" type="button" onClick={() => counter.add()}>
            add
          </button>
        </>
      )
    }

    const { container } = render(
      <LocalProvider>
        <SubApp />
      </LocalProvider>
    )

    expect(container.querySelector('#state')?.innerHTML).toEqual('1')
    await act(async () => {
      container
        .querySelector('#button')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#state')?.innerHTML).toEqual('2')
  })

  test('nest useSharedModel should get it own context', async () => {
    const { Provider: LocalProviderA, useSharedModel: useSharedModelA } =
      createContainer()
    const { Provider: LocalProviderB, useSharedModel: useSharedModelB } =
      createContainer()

    const C = () => {
      const counterA = useSharedModelA('count', countModel)
      const counterB = useSharedModelB('count', countModel)

      return (
        <>
          <div id="stateCA">{counterA.value}</div>
          <div id="stateCB">{counterB.value}</div>
        </>
      )
    }

    const A = () => {
      const counterA = useSharedModelA('count', countModel)

      return (
        <>
          <div id="stateA">{counterA.value}</div>
          <button id="buttonA" type="button" onClick={() => counterA.add()}>
            add
          </button>
          <C></C>
        </>
      )
    }

    const B = () => {
      const counterB = useSharedModelB('count', countModel)

      return (
        <>
          <div id="stateB">{counterB.value}</div>
          <button id="buttonB" type="button" onClick={() => counterB.add()}>
            add
          </button>
          <C></C>
        </>
      )
    }

    const { container } = render(
      <LocalProviderA>
        <LocalProviderB>
          <A></A>
          <B></B>
        </LocalProviderB>
      </LocalProviderA>
    )

    expect(container.querySelector('#stateA')?.innerHTML).toEqual('1')
    expect(container.querySelector('#stateB')?.innerHTML).toEqual('1')
    expect(container.querySelector('#stateCA')?.innerHTML).toEqual('1')
    expect(container.querySelector('#stateCB')?.innerHTML).toEqual('1')
    await act(async () => {
      container
        .querySelector('#buttonA')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#stateA')?.innerHTML).toEqual('2')
    expect(container.querySelector('#stateB')?.innerHTML).toEqual('1')
    expect(container.querySelector('#stateCA')?.innerHTML).toEqual('2')
    expect(container.querySelector('#stateCB')?.innerHTML).toEqual('1')
  })

  test('each container should be isolation', async () => {
    const { Provider: LocalProviderA, useSharedModel: useSharedModelA } =
      createContainer()

    const A = (props: { id: number }) => {
      const counter = useSharedModelA('count', countModel)

      return (
        <>
          <div id={`stateA${props.id}`}>{counter.value}</div>
          <button
            id={`buttonA${props.id}`}
            type="button"
            onClick={() => counter.add()}
          >
            add
          </button>
        </>
      )
    }

    const Warp = function (props: { id: number }) {
      return (
        <LocalProviderA>
          <A {...props}></A>
        </LocalProviderA>
      )
    }

    const { container } = render(
      <>
        <Warp id={1}></Warp>
        <Warp id={2}></Warp>
      </>
    )

    expect(container.querySelector('#stateA1')?.innerHTML).toEqual('1')
    expect(container.querySelector('#stateA2')?.innerHTML).toEqual('1')
    await act(async () => {
      container
        .querySelector('#buttonA1')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#stateA1')?.innerHTML).toEqual('2')
    expect(container.querySelector('#stateA2')?.innerHTML).toEqual('1')
  })

  test('different containers share same douraStore should has same state', async () => {
    const douraStore = doura()
    const { Provider: LocalProviderA, useSharedModel: useSharedModelA } =
      createContainer()
    const { Provider: LocalProviderB, useSharedModel: useSharedModelB } =
      createContainer()

    const C = () => {
      const counterA = useSharedModelA('count', countModel)
      const counterB = useSharedModelB('count', countModel)

      return (
        <>
          <div id="stateCA">{counterA.value}</div>
          <div id="stateCB">{counterB.value}</div>
        </>
      )
    }

    const A = () => {
      const counterA = useSharedModelA('count', countModel)

      return (
        <>
          <div id="stateA">{counterA.value}</div>
          <button id="buttonA" type="button" onClick={() => counterA.add()}>
            add
          </button>
          <C></C>
        </>
      )
    }

    const B = () => {
      const counterB = useSharedModelB('count', countModel)

      return (
        <>
          <div id="stateB">{counterB.value}</div>
          <button id="buttonB" type="button" onClick={() => counterB.add()}>
            add
          </button>
          <C></C>
        </>
      )
    }

    const { container } = render(
      <LocalProviderA store={douraStore}>
        <LocalProviderB store={douraStore}>
          <A></A>
          <B></B>
        </LocalProviderB>
      </LocalProviderA>
    )

    expect(container.querySelector('#stateA')?.innerHTML).toEqual('1')
    expect(container.querySelector('#stateB')?.innerHTML).toEqual('1')
    expect(container.querySelector('#stateCA')?.innerHTML).toEqual('1')
    expect(container.querySelector('#stateCB')?.innerHTML).toEqual('1')
    await act(async () => {
      container
        .querySelector('#buttonA')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#stateA')?.innerHTML).toEqual('2')
    expect(container.querySelector('#stateB')?.innerHTML).toEqual('2')
    expect(container.querySelector('#stateCA')?.innerHTML).toEqual('2')
    expect(container.querySelector('#stateCB')?.innerHTML).toEqual('2')
  })

  test('douraStore can exist independently wether the component is unmount', async () => {
    const { Provider: LocalProvider, useSharedModel } = createContainer()

    const SubApp = () => {
      const counter = useSharedModel('count', countModel)

      return (
        <>
          <div id="state">{counter.value}</div>
          <button id="button" type="button" onClick={() => counter.add()}>
            add
          </button>
        </>
      )
    }

    const douraStore = doura()

    const App = () => {
      const [toggle, setToggle] = React.useState(true)
      return (
        <>
          <button id="toggle" type="button" onClick={() => setToggle(!toggle)}>
            add
          </button>
          {toggle ? (
            <LocalProvider store={douraStore}>
              <SubApp />
            </LocalProvider>
          ) : null}
        </>
      )
    }

    const { container } = render(<App />)

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
    douraStore.getModel('count', countModel).add(1)
  })

  test('container state should sync with douraStore', async () => {
    const { Provider: LocalProvider, useSharedModel } = createContainer()

    const SubApp = () => {
      const counter = useSharedModel('count', countModel)

      return (
        <>
          <div id="state">{counter.value}</div>
          <button id="button" type="button" onClick={() => counter.add()}>
            add
          </button>
        </>
      )
    }

    const douraStore0 = doura()
    const douraStore1 = doura()

    const App = () => {
      const [toggle, setToggle] = React.useState(true)
      return (
        <>
          <button id="toggle" type="button" onClick={() => setToggle(!toggle)}>
            toggle
          </button>
          <LocalProvider store={toggle ? douraStore0 : douraStore1}>
            <SubApp />
          </LocalProvider>
        </>
      )
    }

    const { container } = render(<App />)

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
    expect(container.querySelector('#state')?.innerHTML).toEqual('1')
    await act(async () => {
      container
        .querySelector('#toggle')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
    })
    expect(container.querySelector('#state')?.innerHTML).toEqual('2')
  })
})

describe('createContainer/DouraRoot', () => {
  test('DouraRoot should worked without props douraStore', async () => {
    const App = () => {
      const counter = useRootModel('count', countModel)
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
      const counter = useRootModel('count', countModel)
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

describe('createContainer/useRootModel', () => {
  test('name should be required', async () => {
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

    const App1 = () => {
      const counter = useRootModel(undefined as any, countModel)
      return <div id="value">{counter.value}</div>
    }

    const App2 = () => {
      const counter = useRootModel('', countModel)
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

  test('useRootModel should has parent DouraRoot', async () => {
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
      const counter = useRootModel('count', countModel)

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
      const counter = useRootModel('count', countModel)
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
      const counter = useRootModel('count', countModel)
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
      const counter = useRootModel('count', countModel, selector)
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
      const counter = useRootModel('count', countModel, selector)
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
      const counter = useRootModel('count', countModel)

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

describe('createContainer/useRootStaticModel', () => {
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
      const counter = useRootStaticModel(undefined as any, count)
      return <div id="value">{counter.value}</div>
    }
    const App2 = () => {
      const counter = useRootStaticModel('', count)
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

  test('useRootStaticModel should has parent DouraRoot', async () => {
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
      const counter = useRootStaticModel('count', count)

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
      const counter = useRootStaticModel('count', countModel)
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
