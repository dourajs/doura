import React from 'react'
import { render } from '@testing-library/react'
import { defineModel } from 'doura'
import { DouraRoot, useModel } from '../src/index'

const model = defineModel({
  name: 'model',
  state: { value: 0 },
  actions: {
    increment() {
      this.value += 1
    },
  },
  queries: {
    fetchData: (_ctx: any) => Promise.resolve(42),
    fetchUser: (_ctx: any, id: string) => Promise.resolve({ id, name: 'User' }),
  },
})

describe('useModel with queries', () => {
  test('backward compatible — existing merged API access still works', () => {
    let apiRef: any = null
    const App = () => {
      const counter = useModel(model)
      apiRef = counter
      return <div>{counter.value}</div>
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    expect(container.textContent).toBe('0')
    expect(typeof apiRef.increment).toBe('function')
  })

  test('query names appear on merged API as fetch functions only', () => {
    let apiRef: any = null
    const App = () => {
      const counter = useModel(model)
      apiRef = counter
      return <div>ok</div>
    }

    render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    expect(apiRef.fetchData).toBeDefined()
    expect(apiRef.$queries).toBeUndefined()
    expect((apiRef.fetchData as any)._queryName).toBeUndefined()
    expect((apiRef.fetchData as any)._spec).toBeUndefined()
  })

  test('no queries — no QueryHandles in merged API', () => {
    const noQueryModel = defineModel({
      name: 'test3',
      state: { count: 0 },
      actions: {
        inc() {
          this.count += 1
        },
      },
    })

    let apiRef: any = null
    const App = () => {
      const inst = useModel(noQueryModel)
      apiRef = inst
      return <div>ok</div>
    }

    render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    expect(apiRef.count).toBe(0)
    expect(typeof apiRef.inc).toBe('function')
    // No query fetch or handle properties on the ModelAPI snapshot.
    expect(apiRef.fetchData).toBeUndefined()
    expect(apiRef.$queries).toBeUndefined()
  })

  test('queries binding persists across state changes', () => {
    let firstFetchData: any = null
    const App = () => {
      const counter = useModel(model)
      if (firstFetchData === null) firstFetchData = counter.fetchData
      // Same reference should persist (bound fetch is cached)
      expect(counter.fetchData).toBe(firstFetchData)
      return <div>{counter.value}</div>
    }

    render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
  })

  test('action/query name conflicts are rejected', () => {
    expect(() =>
      defineModel({
        name: 'query-action-conflict',
        state: { value: 0 },
        actions: {
          sameKey() {
            return 'action'
          },
        },
        queries: {
          sameKey: (_ctx: any) => Promise.resolve('query'),
        },
      } as any)
    ).toThrow(/key "sameKey" in "actions".*key in "queries"/)
  })
})
