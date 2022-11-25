/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, act } from '@testing-library/react'
import { defineModel, nextTick } from 'doura'
import { useModel, useRootModel, DouraRoot } from '../src/index'
import { countModel, countSelectorParameters } from './models/index'

const countSelector = function (stateAndViews: countSelectorParameters) {
  return {
    v: stateAndViews.value,
    t: stateAndViews.test,
  }
}

beforeEach(() => {
  jest.useFakeTimers()
})

describe('useModel', () => {
  test('model name could be not defined', async () => {
    const tempModel = defineModel({
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
      const [state, actions] = useModel(tempModel)

      return (
        <>
          <div id="value">{state.value}</div>
          <button id="button" type="button" onClick={() => actions.add()}>
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
    test('should isolation with useRootModel', async () => {
      const App = () => {
        const [state, actions] = useRootModel('count', countModel)
        const [state1, actions1] = useModel(countModel)

        return (
          <>
            <div id="value">{state.value}</div>
            <button id="button" type="button" onClick={() => actions.add(2)}>
              add
            </button>
            <div id="value1">{state1.value}</div>
            <button id="button1" type="button" onClick={() => actions1.add(2)}>
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
        const [state, actions] = useModel(countModel)
        const [state1, actions1] = useModel(countModel)

        return (
          <>
            <div id="value">{state.value}</div>
            <button id="button" type="button" onClick={() => actions.add(2)}>
              add
            </button>
            <div id="value1">{state1.value}</div>
            <button id="button1" type="button" onClick={() => actions1.add(2)}>
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

  test('should support selector', async () => {
    const App = () => {
      const [state, actions] = useModel(countModel, countSelector)

      return (
        <>
          <div id="v">{state.v}</div>
          <div id="t">{state.t}</div>
          <button id="button" type="button" onClick={() => actions.add(2)}>
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
})
