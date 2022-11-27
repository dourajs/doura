/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, act } from '@testing-library/react'
import { defineModel, nextTick } from 'doura'
import { useModel, useRootModel, DouraRoot } from '../src/index'
import { countModel } from './models/index'

beforeEach(() => {
  jest.useFakeTimers()
})

describe('useModel', () => {
  test('model name could be not defined', async () => {
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
    test('should isolation with useRootModel', async () => {
      const App = () => {
        const counter = useRootModel('count', countModel)
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
    test('should work', async () => {
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

    test('should not work when return api directly', async () => {
      const App = () => {
        const counter = useModel(countModel, (s) => s, [])

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
      expect(container.querySelector('#v')?.innerHTML).toEqual('1')
      expect(container.querySelector('#t')?.innerHTML).toEqual('2')
    })
  })
})
