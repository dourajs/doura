/**
 * Render isolation tests.
 *
 * Claim under test: changes to one query's cache entry notify only its own
 * subscribers. Components that read a DIFFERENT query on the same model do
 * not re-render because of unrelated cache updates.
 *
 * The pure cache-write paths (handle.setData, plus
 * handle.invalidate/handle.reset targeting a specific query) don't
 * dispatch a model action, so useModel's model-level subscription stays
 * quiet and only the useQuery hook's per-query listener fires.
 */
import React from 'react'
import { render, act, waitFor } from '@testing-library/react'
import { flushSync } from 'react-dom'
import { defineModel, doura, nextTick } from 'doura'
import { DouraRoot, useModel, useStaticModel, useQuery } from '../src/index'

beforeEach(() => {
  jest.useRealTimers()
})

const makeTwoQueryModel = () =>
  defineModel({
    name: 'makeTwoQueryModel',
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let modelId = 0

function makeLandingModel(fetchData: () => Promise<number>) {
  return defineModel(
    {
      name: `landingModel${++modelId}`,
      state: { value: 0 },
      actions: {
        async fetchThenBump() {
          await this.fetchData()
          this.value += 1
        },
      },
      queries: {
        fetchData: (_ctx: any) => fetchData(),
      },
    },
    ({ model }) => {
      model.setQueryOptions('fetchData', {
        onData({ api, data }) {
          api.value = data
        },
      })
    }
  )
}

function commitText(query: any, value?: number) {
  return `${query.isFetching}:${query.data ?? 'none'}:${value ?? 'none'}`
}

describe('render isolation — query landing coalescing', () => {
  test('raw core subscribers coalesce query cache and state in one commit', async () => {
    const model = defineModel({
      name: `rawLandingModel${++modelId}`,
      state: { value: 0 },
      actions: {
        async inner() {
          await Promise.resolve()
          this.$queries.fetchData.setData(1)
          this.value = 1
        },
        async test() {
          await this.inner()
        },
      },
      queries: {
        fetchData: async () => 0,
      },
    })

    const store = doura().getModel(model)
    let commits = 0
    let renders = 0
    const snapshots: string[] = []

    const Comp = () => {
      renders++
      const state = React.useSyncExternalStore(
        (cb) => store.$subscribe(cb),
        () => store.$state,
        () => store.$state
      )
      const data = React.useSyncExternalStore(
        (cb) =>
          (store.$queries.fetchData as any).subscribe([], () => {
            flushSync(cb)
          }),
        () => store.$queries.fetchData.getData(),
        () => store.$queries.fetchData.getData()
      )
      const text = `${data ?? 'none'}:${state.value}`
      snapshots.push(text)
      return <span data-testid="result">{text}</span>
    }

    const { container } = render(
      <React.Profiler id="raw-landing" onRender={() => commits++}>
        <Comp />
      </React.Profiler>
    )

    expect(container.querySelector('[data-testid="result"]')?.textContent).toBe(
      'none:0'
    )

    const baselineCommits = commits
    const baselineRenders = renders

    await act(async () => {
      await store.test()
      await nextTick()
    })

    expect(container.querySelector('[data-testid="result"]')?.textContent).toBe(
      '1:1'
    )
    expect(snapshots).not.toContain('1:0')
    expect(commits - baselineCommits).toBe(1)
    expect(renders - baselineRenders).toBe(1)
  })

  test('onData and query cache landing commit once in the same component', async () => {
    const pending = deferred<number>()
    const model = makeLandingModel(() => pending.promise)

    let commits = 0
    let renders = 0

    const Comp = () => {
      renders++
      const api = useModel(model)
      const query = useQuery(api.fetchData)
      return <span data-testid="result">{commitText(query, api.value)}</span>
    }

    const { container } = render(
      <DouraRoot>
        <React.Profiler id="landing" onRender={() => commits++}>
          <Comp />
        </React.Profiler>
      </DouraRoot>
    )

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="result"]')?.textContent
      ).toBe('true:none:0')
    })

    const baselineCommits = commits
    const baselineRenders = renders

    await act(async () => {
      pending.resolve(1)
    })

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="result"]')?.textContent
      ).toBe('false:1:1')
    })
    expect(commits - baselineCommits).toBe(1)
    expect(renders - baselineRenders).toBe(1)
  })

  test('await query.fetch followed by state mutation lands in one commit', async () => {
    const pending = deferred<number>()
    const model = makeLandingModel(() => pending.promise)

    let commits = 0
    let renders = 0

    const Comp = () => {
      renders++
      const api = useModel(model)
      const query = useQuery(api.fetchData, { enabled: false })
      return (
        <>
          <button data-testid="load" onClick={() => api.fetchThenBump()} />
          <span data-testid="result">{commitText(query, api.value)}</span>
        </>
      )
    }

    const { container } = render(
      <DouraRoot>
        <React.Profiler id="landing" onRender={() => commits++}>
          <Comp />
        </React.Profiler>
      </DouraRoot>
    )

    await act(async () => {
      container
        .querySelector('[data-testid="load"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="result"]')?.textContent
      ).toBe('true:none:0')
    })

    const baselineCommits = commits
    const baselineRenders = renders

    await act(async () => {
      pending.resolve(1)
    })

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="result"]')?.textContent
      ).toBe('false:1:2')
    })
    expect(commits - baselineCommits).toBe(1)
    expect(renders - baselineRenders).toBe(1)
  })

  test('split useModel and useQuery subscribers land in one shared commit', async () => {
    const pending = deferred<number>()
    const model = makeLandingModel(() => pending.promise)

    let commits = 0
    let modelRenders = 0
    let queryRenders = 0

    const ModelPanel = () => {
      modelRenders++
      const api = useModel(model)
      return <span data-testid="model">{api.value}</span>
    }

    const QueryPanel = () => {
      queryRenders++
      const api = useStaticModel(model)
      const query = useQuery(api.fetchData)
      return <span data-testid="query">{commitText(query)}</span>
    }

    const { container } = render(
      <DouraRoot>
        <React.Profiler id="landing" onRender={() => commits++}>
          <ModelPanel />
          <QueryPanel />
        </React.Profiler>
      </DouraRoot>
    )

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="model"]')?.textContent
      ).toBe('0')
      expect(
        container.querySelector('[data-testid="query"]')?.textContent
      ).toBe('true:none:none')
    })

    const baselineCommits = commits
    const baselineModelRenders = modelRenders
    const baselineQueryRenders = queryRenders

    await act(async () => {
      pending.resolve(1)
    })

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="model"]')?.textContent
      ).toBe('1')
      expect(
        container.querySelector('[data-testid="query"]')?.textContent
      ).toBe('false:1:none')
    })
    expect(commits - baselineCommits).toBe(1)
    expect(modelRenders - baselineModelRenders).toBe(1)
    expect(queryRenders - baselineQueryRenders).toBe(1)
  })

  test('query-only subscriber lands in one commit', async () => {
    const pending = deferred<number>()
    const model = makeLandingModel(() => pending.promise)

    let commits = 0
    let renders = 0

    const Comp = () => {
      renders++
      const api = useStaticModel(model)
      const query = useQuery(api.fetchData)
      return <span data-testid="result">{commitText(query)}</span>
    }

    const { container } = render(
      <DouraRoot>
        <React.Profiler id="landing" onRender={() => commits++}>
          <Comp />
        </React.Profiler>
      </DouraRoot>
    )

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="result"]')?.textContent
      ).toBe('true:none:none')
    })

    const baselineCommits = commits
    const baselineRenders = renders

    await act(async () => {
      pending.resolve(1)
    })

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="result"]')?.textContent
      ).toBe('false:1:none')
    })
    expect(commits - baselineCommits).toBe(1)
    expect(renders - baselineRenders).toBe(1)
  })
})

describe('render isolation — cross-query cache updates', () => {
  test('setData on query A does not re-render components of query B', async () => {
    const model = makeTwoQueryModel()

    let rendersA = 0
    let rendersB = 0
    let handleARef: any = null

    const CompA = () => {
      const api = useModel(model)
      handleARef = api.$queries.qA
      rendersA++
      const { data } = useQuery(api.qA)
      return <span data-testid="a">{String(data ?? 'none')}</span>
    }

    const CompB = () => {
      const api = useModel(model)
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
    await waitFor(() => {
      expect(container.querySelector('[data-testid="a"]')?.textContent).toBe(
        'A-updated'
      )
      expect(rendersA).toBeGreaterThan(baselineA)
    })

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
      const api = useModel(model)
      handleARef = api.$queries.qA
      rendersA++
      const { data } = useQuery(api.qA)
      return <span data-testid="a-data">{String(data ?? 'none')}</span>
    }

    const CompB = () => {
      const api = useModel(model)
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

    await waitFor(() => {
      expect(rendersA).toBeGreaterThan(baselineA)
    })
    expect(rendersB).toBe(baselineB)
  })

  test("reset on query A targets only A's subscribers", async () => {
    const model = makeTwoQueryModel()

    let rendersA = 0
    let rendersB = 0
    let handleARef: any = null

    const CompA = () => {
      const api = useModel(model)
      handleARef = api.$queries.qA
      rendersA++
      const { data } = useQuery(api.qA)
      return <span data-testid="a3-data">{String(data ?? 'none')}</span>
    }

    const CompB = () => {
      const api = useModel(model)
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

    await waitFor(() => {
      expect(rendersA).toBeGreaterThan(baselineA)
    })
    expect(rendersB).toBe(baselineB)
  })
})

describe('render isolation — same query shared across components', () => {
  test('components reading the same query share one fetch and both re-render on update', async () => {
    let fetchCount = 0
    const model = defineModel({
      name: 'model',
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
      const api = useModel(model)
      handleRef = api.$queries.shared
      rendersA++
      const { data } = useQuery(api.shared)
      return <span data-testid="a">{String(data ?? 'none')}</span>
    }
    const CompB = () => {
      const api = useModel(model)
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

    await waitFor(() => {
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
})

describe('render isolation — state change still affects useModel consumers', () => {
  test('bumping state re-renders both useModel consumers regardless of their queries', async () => {
    const model = makeTwoQueryModel()

    let rendersA = 0
    let rendersB = 0
    let apiRef: any = null

    const CompA = () => {
      const api = useModel(model)
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
      const api = useModel(model)
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

    await waitFor(() => {
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
})
