/**
 * Render isolation tests.
 *
 * Claim under test: changes to one query's cache entry notify only its own
 * subscribers. Components that read a DIFFERENT query on the same model do
 * not re-render because of unrelated cache updates.
 *
 * The pure cache-write paths ($setQueryData without a custom onData, plus
 * $invalidateQueries/$resetQueries targeting a specific query name) don't
 * dispatch a model action, so useModel's model-level subscription stays
 * quiet and only the useQuery hook's per-query listener fires.
 */
import React from 'react'
import { render, act, waitFor } from '@testing-library/react'
import { defineModel } from 'doura'
import { DouraRoot, useModel } from '../src/useModel'
import { useQuery } from '../src/useQuery'

beforeEach(() => {
  jest.useRealTimers()
})

const makeTwoQueryModel = () =>
  defineModel({
    state: { version: 0 },
    actions: {
      bumpVersion() {
        this.version += 1
      },
    },
    queries: {
      qA: (_ctx: any) => Promise.resolve('A-initial'),
      qB: (_ctx: any) => Promise.resolve('B-initial'),
    },
  })

describe('render isolation — cross-query cache updates', () => {
  test('setData on query A does not re-render components of query B', async () => {
    const model = makeTwoQueryModel()

    let rendersA = 0
    let rendersB = 0
    let handleARef: any = null

    const CompA = () => {
      const api = useModel('iso1', model)
      handleARef = api.qA
      rendersA++
      const { data } = useQuery(api.qA)
      return <span data-testid="a">{String(data ?? 'none')}</span>
    }

    const CompB = () => {
      const api = useModel('iso1', model)
      rendersB++
      const { data } = useQuery(api.qB)
      return <span data-testid="b">{String(data ?? 'none')}</span>
    }

    const { container } = render(
      <DouraRoot>
        <CompA />
        <CompB />
      </DouraRoot>
    )

    await waitFor(() => {
      expect(container.querySelector('[data-testid="a"]')?.textContent).toBe(
        'A-initial'
      )
      expect(container.querySelector('[data-testid="b"]')?.textContent).toBe(
        'B-initial'
      )
    })

    const baselineA = rendersA
    const baselineB = rendersB

    // Write new data into query A's cache only via the handle.
    await act(async () => {
      handleARef.setData('A-updated')
    })

    // A must reflect the update and re-render.
    expect(container.querySelector('[data-testid="a"]')?.textContent).toBe(
      'A-updated'
    )
    expect(rendersA).toBeGreaterThan(baselineA)

    // B must stay put — no re-render triggered by A's cache write.
    expect(rendersB).toBe(baselineB)
    expect(container.querySelector('[data-testid="b"]')?.textContent).toBe(
      'B-initial'
    )
  })

  test("invalidate on query A targets only A's subscribers", async () => {
    const model = makeTwoQueryModel()

    let rendersA = 0
    let rendersB = 0
    let handleARef: any = null

    const CompA = () => {
      const api = useModel('iso2', model)
      handleARef = api.qA
      rendersA++
      const { data } = useQuery(api.qA)
      return <span data-testid="a-data">{String(data ?? 'none')}</span>
    }

    const CompB = () => {
      const api = useModel('iso2', model)
      rendersB++
      const { data } = useQuery(api.qB)
      return <span data-testid="b-data">{String(data ?? 'none')}</span>
    }

    const { container } = render(
      <DouraRoot>
        <CompA />
        <CompB />
      </DouraRoot>
    )

    // Wait until BOTH queries have fully landed.
    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="a-data"]')?.textContent
      ).toBe('A-initial')
      expect(
        container.querySelector('[data-testid="b-data"]')?.textContent
      ).toBe('B-initial')
    })

    const baselineA = rendersA
    const baselineB = rendersB

    // Invalidate only qA — qB's cache entry is untouched.
    await act(async () => {
      handleARef.invalidate()
      await Promise.resolve()
    })

    expect(rendersA).toBeGreaterThan(baselineA)
    expect(rendersB).toBe(baselineB)
  })

  test("reset on query A targets only A's subscribers", async () => {
    const model = makeTwoQueryModel()

    let rendersA = 0
    let rendersB = 0
    let handleARef: any = null

    const CompA = () => {
      const api = useModel('iso3', model)
      handleARef = api.qA
      rendersA++
      const { data } = useQuery(api.qA)
      return <span data-testid="a3-data">{String(data ?? 'none')}</span>
    }

    const CompB = () => {
      const api = useModel('iso3', model)
      rendersB++
      const { data } = useQuery(api.qB)
      return <span data-testid="b3-data">{String(data ?? 'none')}</span>
    }

    const { container } = render(
      <DouraRoot>
        <CompA />
        <CompB />
      </DouraRoot>
    )
    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="a3-data"]')?.textContent
      ).toBe('A-initial')
      expect(
        container.querySelector('[data-testid="b3-data"]')?.textContent
      ).toBe('B-initial')
    })

    const baselineA = rendersA
    const baselineB = rendersB

    await act(async () => {
      handleARef.reset()
    })

    expect(rendersA).toBeGreaterThan(baselineA)
    expect(rendersB).toBe(baselineB)
  })
})

describe('render isolation — same query shared across components', () => {
  test('components reading the same query share one fetch and both re-render on update', async () => {
    let fetchCount = 0
    const model = defineModel({
      state: {},
      queries: {
        shared: (_ctx: any) => {
          fetchCount++
          return Promise.resolve('shared-value')
        },
      },
    })

    let rendersA = 0
    let rendersB = 0
    let handleRef: any = null

    const CompA = () => {
      const api = useModel('iso-shared', model)
      handleRef = api.shared
      rendersA++
      const { data } = useQuery(api.shared)
      return <span data-testid="a">{String(data ?? 'none')}</span>
    }
    const CompB = () => {
      const api = useModel('iso-shared', model)
      rendersB++
      const { data } = useQuery(api.shared)
      return <span data-testid="b">{String(data ?? 'none')}</span>
    }

    const { container } = render(
      <DouraRoot>
        <CompA />
        <CompB />
      </DouraRoot>
    )
    await waitFor(() => {
      expect(container.querySelector('[data-testid="a"]')?.textContent).toBe(
        'shared-value'
      )
      expect(container.querySelector('[data-testid="b"]')?.textContent).toBe(
        'shared-value'
      )
    })
    // FetchManager dedup — only one actual network call.
    expect(fetchCount).toBe(1)

    const beforeA = rendersA
    const beforeB = rendersB

    // Update the shared entry — both subscribers must see the new value.
    await act(async () => {
      handleRef.setData('shared-updated')
    })

    expect(rendersA).toBeGreaterThan(beforeA)
    expect(rendersB).toBeGreaterThan(beforeB)
    expect(container.querySelector('[data-testid="a"]')?.textContent).toBe(
      'shared-updated'
    )
    expect(container.querySelector('[data-testid="b"]')?.textContent).toBe(
      'shared-updated'
    )
  })
})

describe('render isolation — state change still affects useModel consumers', () => {
  test('bumping state re-renders both useModel consumers regardless of their queries', async () => {
    const model = makeTwoQueryModel()

    let rendersA = 0
    let rendersB = 0
    let apiRef: any = null

    const CompA = () => {
      const api = useModel('iso-state', model)
      apiRef = api
      rendersA++
      const q = useQuery(api.qA)
      return (
        <span data-testid="a-state-data">
          {String(q.data ?? 'none')}:{api.version}
        </span>
      )
    }
    const CompB = () => {
      const api = useModel('iso-state', model)
      rendersB++
      const q = useQuery(api.qB)
      return (
        <span data-testid="b-state-data">
          {String(q.data ?? 'none')}:{api.version}
        </span>
      )
    }

    const { container } = render(
      <DouraRoot>
        <CompA />
        <CompB />
      </DouraRoot>
    )
    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="a-state-data"]')?.textContent
      ).toBe('A-initial:0')
      expect(
        container.querySelector('[data-testid="b-state-data"]')?.textContent
      ).toBe('B-initial:0')
    })

    const beforeA = rendersA
    const beforeB = rendersB

    // Dispatch a state change — both useModel subscriptions fire.
    await act(async () => {
      apiRef.bumpVersion()
    })

    expect(rendersA).toBeGreaterThan(beforeA)
    expect(rendersB).toBeGreaterThan(beforeB)
    expect(
      container.querySelector('[data-testid="a-state-data"]')?.textContent
    ).toBe('A-initial:1')
    expect(
      container.querySelector('[data-testid="b-state-data"]')?.textContent
    ).toBe('B-initial:1')
  })
})
