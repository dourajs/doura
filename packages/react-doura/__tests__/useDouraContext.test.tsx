import React from 'react'
import { render } from '@testing-library/react'
import { doura } from 'doura'
import { createContainer, useDouraContext } from '../src/index'

jest.useFakeTimers()

describe('useDouraContext', () => {
  test('should throw when used outside any Provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const App = () => {
      useDouraContext()
      return null
    }

    expect(() => render(<App />)).toThrow(
      '[react-doura]: could not find react-doura context value'
    )

    spy.mockRestore()
  })

  test('should return the store from the nearest Provider', () => {
    const store1 = doura()
    const store2 = doura()
    const { Provider: ProviderA } = createContainer()
    const { Provider: ProviderB } = createContainer()

    let capturedStore: any

    const Inner = () => {
      const ctx = useDouraContext()
      capturedStore = ctx.store
      return null
    }

    render(
      <ProviderA store={store1}>
        <ProviderB store={store2}>
          <Inner />
        </ProviderB>
      </ProviderA>
    )

    expect(capturedStore).toBe(store2)
  })

  test('should return the outer store when not nested', () => {
    const store = doura()
    const { Provider } = createContainer()

    let capturedStore: any

    const Inner = () => {
      const ctx = useDouraContext()
      capturedStore = ctx.store
      return null
    }

    render(
      <Provider store={store}>
        <Inner />
      </Provider>
    )

    expect(capturedStore).toBe(store)
  })

  test('should work across Providers from different createContainer calls', () => {
    const store1 = doura()
    const store2 = doura()
    const { Provider: ProviderA } = createContainer()
    const { Provider: ProviderB } = createContainer()

    const captured: any[] = []

    const OuterReader = () => {
      const ctx = useDouraContext()
      captured.push({ label: 'outer', store: ctx.store })
      return null
    }

    const InnerReader = () => {
      const ctx = useDouraContext()
      captured.push({ label: 'inner', store: ctx.store })
      return null
    }

    render(
      <ProviderA store={store1}>
        <OuterReader />
        <ProviderB store={store2}>
          <InnerReader />
        </ProviderB>
      </ProviderA>
    )

    const outer = captured.find((c) => c.label === 'outer')
    const inner = captured.find((c) => c.label === 'inner')
    expect(outer!.store).toBe(store1)
    expect(inner!.store).toBe(store2)
  })

  test('should work with Provider that creates store internally', () => {
    const { Provider } = createContainer()

    let capturedStore: any

    const Inner = () => {
      const ctx = useDouraContext()
      capturedStore = ctx.store
      return null
    }

    render(
      <Provider>
        <Inner />
      </Provider>
    )

    expect(capturedStore).toBeTruthy()
  })
})
