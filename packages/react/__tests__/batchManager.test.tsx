/**
 * @jest-environment jsdom
 */

import React, { useEffect, useState } from 'react'
import { render, act } from '@testing-library/react'
import { doura, nextTick } from 'doura'
import { createBatchManager } from '../src/batchManager'
import { countModel } from './models/index'

let douraStore: ReturnType<typeof doura>
let batchManager: ReturnType<typeof createBatchManager>

jest.useFakeTimers()

beforeEach(() => {
  douraStore = doura()
  batchManager = createBatchManager()
})

afterEach(() => {})

describe('batchedUpdates', () => {
  test('addSubscribe worked', async () => {
    const App = () => {
      const [index, setIndex] = useState(0)

      useEffect(() => {
        batchManager.addSubscribe(douraStore.getModel(countModel), function () {
          setIndex(1)
        })
      })

      return (
        <>
          <div id="value">{index}</div>
        </>
      )
    }

    const { container } = render(<App />)

    expect(container.querySelector('#value')?.innerHTML).toEqual('0')
    await act(async () => {
      douraStore.getModel(countModel).add()
      await nextTick()
    })
    expect(container.querySelector('#value')?.innerHTML).toEqual('1')
  })

  test('triggerSubscribe worked', () => {
    const App = () => {
      const [index, setIndex] = useState(0)

      useEffect(() => {
        batchManager.addSubscribe(douraStore.getModel(countModel), function () {
          setIndex(1)
        })
      })

      return (
        <>
          <div id="value">{index}</div>
        </>
      )
    }
    const { container } = render(<App />)

    expect(container.querySelector('#value')?.innerHTML).toEqual('0')
    act(() => {
      batchManager.triggerSubscribe(douraStore.getModel(countModel))
    })
    expect(container.querySelector('#value')?.innerHTML).toEqual('1')
  })

  test('unSubscribe worked', async () => {
    let unsubscribe: any
    const App = () => {
      const [index, setIndex] = useState(0)

      useEffect(() => {
        unsubscribe = batchManager.addSubscribe(
          douraStore.getModel(countModel),
          function () {
            setIndex(1)
          }
        )
      })

      return (
        <>
          <div id="value">{index}</div>
        </>
      )
    }
    const { container } = render(<App />)

    expect(container.querySelector('#value')?.innerHTML).toEqual('0')
    await act(async () => {
      unsubscribe()
      douraStore.getModel(countModel).add()
      await nextTick()
    })
    expect(container.querySelector('#value')?.innerHTML).toEqual('0')
  })

  test("render should be batched when update occurs out of react's lifecycle", async () => {
    let renderCount = 0
    const App = () => {
      renderCount++
      const [index, setIndex] = useState(0)
      const [index1, setIndex1] = useState(0)

      useEffect(() => {
        batchManager.addSubscribe(douraStore.getModel(countModel), function () {
          setIndex(1)
        })
        batchManager.addSubscribe(douraStore.getModel(countModel), function () {
          setIndex1(1)
        })
      })

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
    expect(renderCount).toBe(2)
    expect(container.querySelector('#value')?.innerHTML).toEqual('1')
    expect(container.querySelector('#value1')?.innerHTML).toEqual('1')
  })
})
