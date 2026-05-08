import React, { StrictMode } from 'react'
import { render, act, waitFor } from '@testing-library/react'
import { defineModel } from 'doura'
import { DouraRoot, useModel } from '../src/useModel'
import { useInfiniteQuery } from '../src/useInfiniteQuery'

beforeEach(() => {
  jest.useRealTimers()
})

type Page = { items: string[]; nextCursor: number | null }

const pageData: Record<number, Page> = {
  0: { items: ['a', 'b'], nextCursor: 1 },
  1: { items: ['c', 'd'], nextCursor: 2 },
  2: { items: ['e'], nextCursor: null },
}

const getNextArgs = (lastPage: Page): [number] | undefined =>
  lastPage.nextCursor !== null ? [lastPage.nextCursor] : undefined

const makeModel = (fetchFn?: (cursor: number) => Promise<Page>) =>
  defineModel({
    name: 'makeModel',
    state: {},
    queries: {
      fetchPage: (_ctx: any, cursor: number) =>
        fetchFn
          ? fetchFn(cursor)
          : Promise.resolve(
              pageData[cursor] || { items: [], nextCursor: null }
            ),
    },
  })

describe('useInfiniteQuery — initial fetch', () => {
  test('loads the initial page on mount', async () => {
    const model = makeModel()
    const App = () => {
      const api = useModel(model)
      const r = useInfiniteQuery(api.fetchPage, {
        initialArgs: [0],
        getNextArgs,
      })
      return (
        <div>
          <span id="pages">{r.data ? r.data.pages.length : 0}</span>
          <span id="items">
            {r.data ? r.data.pages.flatMap((p) => p.items).join(',') : ''}
          </span>
          <span id="loading">{String(r.isLoading)}</span>
          <span id="success">{String(r.isSuccess)}</span>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    await waitFor(() => {
      expect(container.querySelector('#pages')?.textContent).toBe('1')
    })
    expect(container.querySelector('#items')?.textContent).toBe('a,b')
    expect(container.querySelector('#success')?.textContent).toBe('true')
  })

  test('hasNextPage is true when getNextArgs returns args', async () => {
    const model = makeModel()
    const App = () => {
      const api = useModel(model)
      const r = useInfiniteQuery(api.fetchPage, {
        initialArgs: [0],
        getNextArgs,
      })
      return (
        <div>
          <span id="pages">{r.data ? r.data.pages.length : 0}</span>
          <span id="hasNext">{String(r.hasNextPage)}</span>
        </div>
      )
    }
    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await waitFor(() => {
      expect(container.querySelector('#pages')?.textContent).toBe('1')
    })
    expect(container.querySelector('#hasNext')?.textContent).toBe('true')
  })

  test('StrictMode double-mount triggers only one initial fetch', async () => {
    let fetchCount = 0
    const model = makeModel((cursor) => {
      fetchCount++
      return Promise.resolve(
        pageData[cursor] || { items: [], nextCursor: null }
      )
    })

    const App = () => {
      const api = useModel(model)
      const r = useInfiniteQuery(api.fetchPage, {
        initialArgs: [0],
        getNextArgs,
      })
      return <span id="pages">{r.data ? r.data.pages.length : 0}</span>
    }
    const { container } = render(
      <StrictMode>
        <DouraRoot>
          <App />
        </DouraRoot>
      </StrictMode>
    )
    await waitFor(() => {
      expect(container.querySelector('#pages')?.textContent).toBe('1')
    })
    expect(fetchCount).toBe(1)
  })
})

describe('useInfiniteQuery — fetchNextPage', () => {
  test('appends new pages and updates hasNextPage', async () => {
    const model = makeModel()
    const App = () => {
      const api = useModel(model)
      const r = useInfiniteQuery(api.fetchPage, {
        initialArgs: [0],
        getNextArgs,
      })
      return (
        <div>
          <span id="pages">{r.data ? r.data.pages.length : 0}</span>
          <span id="items">
            {r.data ? r.data.pages.flatMap((p) => p.items).join(',') : ''}
          </span>
          <span id="hasNext">{String(r.hasNextPage)}</span>
          <button id="next" onClick={() => r.fetchNextPage()}>
            next
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
      expect(container.querySelector('#pages')?.textContent).toBe('1')
    })

    await act(async () => {
      container
        .querySelector('#next')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => {
      expect(container.querySelector('#pages')?.textContent).toBe('2')
    })
    expect(container.querySelector('#items')?.textContent).toBe('a,b,c,d')
    expect(container.querySelector('#hasNext')?.textContent).toBe('true')

    await act(async () => {
      container
        .querySelector('#next')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => {
      expect(container.querySelector('#pages')?.textContent).toBe('3')
    })
    expect(container.querySelector('#items')?.textContent).toBe('a,b,c,d,e')
    // Last page has nextCursor=null, so hasNextPage should flip false
    expect(container.querySelector('#hasNext')?.textContent).toBe('false')
  })

  test('fetchNextPage is a no-op when hasNextPage is false', async () => {
    let fetchCount = 0
    const model = makeModel((cursor) => {
      fetchCount++
      return Promise.resolve(
        pageData[cursor] || { items: [], nextCursor: null }
      )
    })
    const App = () => {
      const api = useModel(model)
      const r = useInfiniteQuery(api.fetchPage, {
        initialArgs: [2], // last page, nextCursor=null
        getNextArgs,
      })
      return (
        <div>
          <span id="pages">{r.data ? r.data.pages.length : 0}</span>
          <span id="hasNext">{String(r.hasNextPage)}</span>
          <button id="next" onClick={() => r.fetchNextPage()}>
            next
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
      expect(container.querySelector('#pages')?.textContent).toBe('1')
    })
    expect(container.querySelector('#hasNext')?.textContent).toBe('false')
    expect(fetchCount).toBe(1)

    await act(async () => {
      container
        .querySelector('#next')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    // Still 1 — no fetch fired
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchCount).toBe(1)
    expect(container.querySelector('#pages')?.textContent).toBe('1')
  })

  test('isFetchingNextPage reflects the in-flight next-page fetch', async () => {
    let resolveSecond!: (v: Page) => void
    const model = makeModel((cursor) => {
      if (cursor === 0) return Promise.resolve(pageData[0])
      return new Promise<Page>((r) => (resolveSecond = r))
    })
    const App = () => {
      const api = useModel(model)
      const r = useInfiniteQuery(api.fetchPage, {
        initialArgs: [0],
        getNextArgs,
      })
      return (
        <div>
          <span id="pages">{r.data ? r.data.pages.length : 0}</span>
          <span id="fetchingNext">{String(r.isFetchingNextPage)}</span>
          <button id="next" onClick={() => r.fetchNextPage()}>
            next
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
      expect(container.querySelector('#pages')?.textContent).toBe('1')
    })
    expect(container.querySelector('#fetchingNext')?.textContent).toBe('false')

    await act(async () => {
      container
        .querySelector('#next')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#fetchingNext')?.textContent).toBe('true')

    await act(async () => {
      resolveSecond(pageData[1])
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(container.querySelector('#fetchingNext')?.textContent).toBe(
        'false'
      )
    })
    expect(container.querySelector('#pages')?.textContent).toBe('2')
  })
})

describe('useInfiniteQuery — fetchPreviousPage', () => {
  test('prepends pages and respects getPreviousArgs', async () => {
    // Build a bidirectional dataset: cursors -2..2
    type BiPage = {
      items: string[]
      prev: number | null
      next: number | null
    }
    const bidir: Record<number, BiPage> = {
      [-2]: { items: ['A'], prev: null, next: -1 },
      [-1]: { items: ['B'], prev: -2, next: 0 },
      0: { items: ['C'], prev: -1, next: 1 },
      1: { items: ['D'], prev: 0, next: 2 },
      2: { items: ['E'], prev: 1, next: null },
    }

    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchSymPage: (_ctx: any, cursor: number): Promise<BiPage> =>
          Promise.resolve(bidir[cursor]),
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useInfiniteQuery(api.fetchSymPage, {
        initialArgs: [0],
        getNextArgs: (last: BiPage): [number] | undefined =>
          last.next !== null ? [last.next] : undefined,
        getPreviousArgs: (first: BiPage): [number] | undefined =>
          first.prev !== null ? [first.prev] : undefined,
      })
      return (
        <div>
          <span id="pages">{r.data ? r.data.pages.length : 0}</span>
          <span id="items">
            {r.data
              ? r.data.pages.flatMap((p: BiPage) => p.items).join(',')
              : ''}
          </span>
          <span id="hasPrev">{String(r.hasPreviousPage)}</span>
          <span id="hasNext">{String(r.hasNextPage)}</span>
          <button id="prev" onClick={() => r.fetchPreviousPage()}>
            prev
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
      expect(container.querySelector('#pages')?.textContent).toBe('1')
    })
    expect(container.querySelector('#items')?.textContent).toBe('C')
    expect(container.querySelector('#hasPrev')?.textContent).toBe('true')

    await act(async () => {
      container
        .querySelector('#prev')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => {
      expect(container.querySelector('#pages')?.textContent).toBe('2')
    })
    expect(container.querySelector('#items')?.textContent).toBe('B,C')

    await act(async () => {
      container
        .querySelector('#prev')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => {
      expect(container.querySelector('#pages')?.textContent).toBe('3')
    })
    expect(container.querySelector('#items')?.textContent).toBe('A,B,C')
    expect(container.querySelector('#hasPrev')?.textContent).toBe('false')
  })

  test('hasPreviousPage is false when getPreviousArgs is not provided', async () => {
    const model = makeModel()
    const App = () => {
      const api = useModel(model)
      const r = useInfiniteQuery(api.fetchPage, {
        initialArgs: [0],
        getNextArgs,
        // no getPreviousArgs
      })
      return (
        <div>
          <span id="pages">{r.data ? r.data.pages.length : 0}</span>
          <span id="hasPrev">{String(r.hasPreviousPage)}</span>
        </div>
      )
    }
    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await waitFor(() => {
      expect(container.querySelector('#pages')?.textContent).toBe('1')
    })
    expect(container.querySelector('#hasPrev')?.textContent).toBe('false')
  })
})

describe('useInfiniteQuery — error handling', () => {
  test('initial fetch error surfaces via isError / error, keeps data undefined', async () => {
    const model = makeModel(() => Promise.reject(new Error('boom')))
    const App = () => {
      const api = useModel(model)
      const r = useInfiniteQuery(api.fetchPage, {
        initialArgs: [0],
        getNextArgs,
      })
      return (
        <div>
          <span id="isError">{String(r.isError)}</span>
          <span id="error">
            {r.error ? (r.error as Error).message : 'none'}
          </span>
          <span id="pages">{r.data ? r.data.pages.length : 0}</span>
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
    expect(container.querySelector('#error')?.textContent).toBe('boom')
    expect(container.querySelector('#pages')?.textContent).toBe('0')
  })
})

describe('useInfiniteQuery — refetch', () => {
  test('resets to initial page', async () => {
    const model = makeModel()
    const App = () => {
      const api = useModel(model)
      const r = useInfiniteQuery(api.fetchPage, {
        initialArgs: [0],
        getNextArgs,
      })
      return (
        <div>
          <span id="pages">{r.data ? r.data.pages.length : 0}</span>
          <button id="next" onClick={() => r.fetchNextPage()}>
            next
          </button>
          <button id="refetch" onClick={() => r.refetch()}>
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
      expect(container.querySelector('#pages')?.textContent).toBe('1')
    })

    await act(async () => {
      container
        .querySelector('#next')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => {
      expect(container.querySelector('#pages')?.textContent).toBe('2')
    })

    await act(async () => {
      container
        .querySelector('#refetch')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => {
      expect(container.querySelector('#pages')?.textContent).toBe('1')
    })
  })
})

describe('useInfiniteQuery — race guard', () => {
  test('refetch during an in-flight fetchNextPage — stale next-page does not append', async () => {
    const resolvers: Record<number, (v: Page) => void> = {}
    const model = defineModel({
      name: 'model',
      state: {},
      queries: {
        fetchPage: (_ctx: any, cursor: number) =>
          new Promise<Page>((resolve) => {
            resolvers[cursor] = resolve
          }),
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useInfiniteQuery(api.fetchPage, {
        initialArgs: [0],
        getNextArgs,
      })
      return (
        <div>
          <span id="pages">{r.data ? r.data.pages.length : 0}</span>
          <span id="items">
            {r.data ? r.data.pages.flatMap((p) => p.items).join(',') : ''}
          </span>
          <button id="next" onClick={() => r.fetchNextPage()}>
            next
          </button>
          <button id="refetch" onClick={() => r.refetch()}>
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

    // Resolve initial (cursor=0)
    await act(async () => {
      resolvers[0]({ items: ['a'], nextCursor: 1 })
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(container.querySelector('#pages')?.textContent).toBe('1')
    })

    // Kick off next page (cursor=1) — leave it hanging
    await act(async () => {
      container
        .querySelector('#next')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Refetch superseded the in-flight next page
    await act(async () => {
      container
        .querySelector('#refetch')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Refetch issues a fresh cursor=0 — resolve it
    await act(async () => {
      resolvers[0]({ items: ['a-refetched'], nextCursor: 1 })
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(container.querySelector('#items')?.textContent).toBe('a-refetched')
    })
    expect(container.querySelector('#pages')?.textContent).toBe('1')

    // Now resolve the stale cursor=1 — must NOT append
    await act(async () => {
      resolvers[1]({ items: ['b-stale'], nextCursor: 2 })
      await Promise.resolve()
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(container.querySelector('#pages')?.textContent).toBe('1')
    expect(container.querySelector('#items')?.textContent).toBe('a-refetched')
  })
})
