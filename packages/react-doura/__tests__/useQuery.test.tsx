import React, { StrictMode } from 'react'
import { render, act, waitFor } from '@testing-library/react'
import { defineModel, doura } from 'doura'
import { createContainer } from '../src/createContainer'
import { DouraRoot, useModel } from '../src/useModel'
import { useQuery } from '../src/useQuery'

// Use real timers — our tests rely on real Promise microtask flush.
// Existing react-doura tests default to fake timers, so we override here.
beforeEach(() => {
  jest.useRealTimers()
})

describe('useQuery', () => {
  test('should fetch data on mount', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchData: (_ctx: any) => Promise.resolve(42),
      },
    })

    const App = () => {
      const api = useModel(model)
      const { data, isLoading, isSuccess } = useQuery(api.fetchData)
      return (
        <div>
          <span id="loading">{String(isLoading)}</span>
          <span id="data">{data !== undefined ? String(data) : 'none'}</span>
          <span id="success">{String(isSuccess)}</span>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    expect(container.querySelector('#loading')?.textContent).toBe('true')

    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toBe('42')
    })
    expect(container.querySelector('#success')?.textContent).toBe('true')
  })

  test('should pass args to query', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchUser: {
          fn: (_ctx: any, id: string) =>
            Promise.resolve({ id, name: 'User ' + id }),
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const { data } = useQuery(api.fetchUser, ['1'])
      return <div id="data">{data ? JSON.stringify(data) : 'none'}</div>
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toContain('User 1')
    })
  })

  test('should reuse the query hash when args tuple contents are unchanged', () => {
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchUser: {
          fn: (_ctx: any, id: string) =>
            Promise.resolve({ id, name: 'User ' + id }),
        },
      },
    })

    let patchHandle: ((handle: any) => void) | undefined
    const computeHash = jest.fn()
    patchHandle = (handle: any) => {
      const original = handle.computeHash.bind(handle)
      handle.computeHash = (...args: any[]) => {
        computeHash(...args)
        return original(...args)
      }
      patchHandle = undefined
    }

    const App = ({ id }: { id: string }) => {
      const api = useModel(model)
      patchHandle?.(api.fetchUser)
      useQuery(api.fetchUser, [id], { enabled: false })
      return <div id="id">{id}</div>
    }

    const { rerender } = render(
      <DouraRoot>
        <App id="1" />
      </DouraRoot>
    )
    expect(computeHash).toHaveBeenCalledTimes(1)

    rerender(
      <DouraRoot>
        <App id="1" />
      </DouraRoot>
    )
    expect(computeHash).toHaveBeenCalledTimes(1)

    rerender(
      <DouraRoot>
        <App id="2" />
      </DouraRoot>
    )
    expect(computeHash).toHaveBeenCalledTimes(2)
  })

  test('should not fetch when enabled is false', async () => {
    const fn = jest.fn(() => Promise.resolve(42))
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchData: (_ctx: any) => fn(),
      },
    })

    const App = () => {
      const api = useModel(model)
      const { data, isPending } = useQuery(api.fetchData, { enabled: false })
      return (
        <div>
          <span id="pending">{String(isPending)}</span>
          <span id="data">{data !== undefined ? String(data) : 'none'}</span>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    // Allow a microtask to settle — nothing should have been fetched.
    await Promise.resolve()
    expect(fn).not.toHaveBeenCalled()
    expect(container.querySelector('#pending')?.textContent).toBe('true')
    expect(container.querySelector('#data')?.textContent).toBe('none')
  })

  test('should apply select transform', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchData: (_ctx: any) => Promise.resolve({ value: 42, extra: 'x' }),
      },
    })

    const App = () => {
      const api = useModel(model)
      const { data } = useQuery(api.fetchData, {
        select: (d: any) => d.value,
      })
      return <div id="data">{data !== undefined ? String(data) : 'none'}</div>
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toBe('42')
    })
  })

  test('should show placeholderData while loading', async () => {
    let resolve!: (v: number) => void
    const slowFn = () => new Promise<number>((r) => (resolve = r))
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchData: (_ctx: any) => slowFn(),
      },
    })

    const App = () => {
      const api = useModel(model)
      const { data, isPlaceholderData } = useQuery(api.fetchData, {
        placeholderData: 99,
      })
      return (
        <div>
          <span id="data">{data !== undefined ? String(data) : 'none'}</span>
          <span id="placeholder">{String(isPlaceholderData)}</span>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    expect(container.querySelector('#data')?.textContent).toBe('99')
    expect(container.querySelector('#placeholder')?.textContent).toBe('true')

    await act(async () => {
      resolve(42)
    })
    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toBe('42')
    })
    expect(container.querySelector('#placeholder')?.textContent).toBe('false')
  })

  test('should handle fetch error', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchData: (_ctx: any) => Promise.reject(new Error('fail')),
      },
    })

    const App = () => {
      const api = useModel(model)
      const { error, isError } = useQuery(api.fetchData)
      return (
        <div>
          <span id="isError">{String(isError)}</span>
          <span id="error">{error ? (error as Error).message : 'none'}</span>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await waitFor(() => {
      expect(container.querySelector('#isError')?.textContent).toBe('true')
    })
    expect(container.querySelector('#error')?.textContent).toBe('fail')
  })

  test('should refetch on refetch() call', async () => {
    let callCount = 0
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchData: (_ctx: any) => Promise.resolve(++callCount),
      },
    })

    const App = () => {
      const api = useModel(model)
      const { data, refetch } = useQuery(api.fetchData)
      return (
        <div>
          <span id="data">{data !== undefined ? String(data) : 'none'}</span>
          <button id="refetch" onClick={() => refetch()}>
            refetch
          </button>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toBe('1')
    })

    await act(async () => {
      container
        .querySelector('#refetch')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toBe('2')
    })
  })

  test('should work in StrictMode', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchData: (_ctx: any) => Promise.resolve(42),
      },
    })

    const App = () => {
      const api = useModel(model)
      const { data } = useQuery(api.fetchData)
      return <div id="data">{data !== undefined ? String(data) : 'none'}</div>
    }

    const { container } = render(
      <StrictMode>
        <DouraRoot>
          <App />
        </DouraRoot>
      </StrictMode>
    )
    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toBe('42')
    })
  })

  test('should deduplicate concurrent fetches for same query+args', async () => {
    const fn = jest.fn((_ctx: any, id: string) => Promise.resolve({ id }))
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchUser: {
          fn,
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      // Two components consuming same query+args — should share fetch
      const a = useQuery(api.fetchUser, ['1'])
      const b = useQuery(api.fetchUser, ['1'])
      return (
        <div>
          <span id="a">{a.data ? 'yes' : 'no'}</span>
          <span id="b">{b.data ? 'yes' : 'no'}</span>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await waitFor(() => {
      expect(container.querySelector('#a')?.textContent).toBe('yes')
    })
    expect(container.querySelector('#b')?.textContent).toBe('yes')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('should unobserve the previous args slot when args change', async () => {
    const store = doura({ query: { gcTime: 0 } })
    const { Provider, useSharedModel } = createContainer()
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchUser: {
          fn: (_ctx: any, id: string) =>
            Promise.resolve({ id, name: 'User ' + id }),
        },
      },
    })

    const App = ({ id }: { id: string }) => {
      const api = useSharedModel(model)
      const { data } = useQuery(api.fetchUser, [id])
      return <div id="data">{data ? data.id : 'none'}</div>
    }

    const { container, rerender } = render(
      <Provider store={store}>
        <App id="1" />
      </Provider>
    )

    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toBe('1')
    })

    const inst = store.getModel(model)

    rerender(
      <Provider store={store}>
        <App id="2" />
      </Provider>
    )

    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toBe('2')
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(inst.$queries.fetchUser.getData('1')).toBeUndefined()
    expect(inst.$queries.fetchUser.getData('2')).toEqual({
      id: '2',
      name: 'User 2',
    })

    store.destroy()
  })
})
