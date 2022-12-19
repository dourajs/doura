import React from 'react'
import { render, act } from '@testing-library/react'
import { doura, Plugin, nextTick } from 'doura'
import { createContainer } from '../src/index'

import { countModel } from './models/index'

jest.useFakeTimers()

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
