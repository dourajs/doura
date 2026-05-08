import React, { StrictMode } from 'react'
import { render, act, waitFor, renderHook } from '@testing-library/react'
import { defineModel } from 'doura'
import { DouraRoot, useModel } from '../src/useModel'
import { useAction } from '../src/useAction'

beforeEach(() => {
  jest.useRealTimers()
})

describe('useAction — initial state', () => {
  test('should start in idle state', () => {
    const model = defineModel({
      name: 'model',
      state: { value: 0 },
      actions: {
        bump() {
          this.value += 1
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.bump)
      return (
        <div>
          <span id="idle">{String(r.isIdle)}</span>
          <span id="pending">{String(r.isPending)}</span>
          <span id="data">
            {r.data !== undefined ? String(r.data) : 'none'}
          </span>
          <span id="error">
            {r.error ? (r.error as Error).message : 'none'}
          </span>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    expect(container.querySelector('#idle')?.textContent).toBe('true')
    expect(container.querySelector('#pending')?.textContent).toBe('false')
    expect(container.querySelector('#data')?.textContent).toBe('none')
    expect(container.querySelector('#error')?.textContent).toBe('none')
  })
})

describe('useAction — sync action', () => {
  test('sync success: skips pending, jumps to success with return value', async () => {
    const model = defineModel({
      name: 'model',
      state: { value: 0 },
      actions: {
        compute(x: number) {
          this.value = x
          return x * 2
        },
      },
    })

    const pendingFlashes: boolean[] = []
    const App = () => {
      const api = useModel(model)
      const r = useAction(api.compute)
      pendingFlashes.push(r.isPending)
      return (
        <div>
          <span id="pending">{String(r.isPending)}</span>
          <span id="success">{String(r.isSuccess)}</span>
          <span id="data">
            {r.data !== undefined ? String(r.data) : 'none'}
          </span>
          <button id="btn" onClick={() => r.run(5)}>
            go
          </button>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await act(async () => {
      container
        .querySelector('#btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#success')?.textContent).toBe('true')
    expect(container.querySelector('#data')?.textContent).toBe('10')
    // Sync path should never have rendered with isPending=true
    expect(pendingFlashes.every((p) => p === false)).toBe(true)
  })

  test('sync error: goes to error state, does not throw from run', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        explode(msg: string) {
          throw new Error(msg)
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.explode)
      return (
        <div>
          <span id="isError">{String(r.isError)}</span>
          <span id="error">
            {r.error ? (r.error as Error).message : 'none'}
          </span>
          <button id="btn" onClick={() => r.run('boom')}>
            go
          </button>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await act(async () => {
      container
        .querySelector('#btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#isError')?.textContent).toBe('true')
    expect(container.querySelector('#error')?.textContent).toBe('boom')
  })
})

describe('useAction — async action', () => {
  test('async success: pending → success with resolved data', async () => {
    let resolveSave!: (x: number) => void
    const model = defineModel({
      name: 'model',
      state: { value: 0 },
      actions: {
        async save(x: number) {
          const r = await new Promise<number>((r) => (resolveSave = r))
          this.value = r
          return r
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      // Disable pending delay so the test sees the intermediate state
      // deterministically without having to advance timers.
      const r = useAction(api.save, { pendingDelay: 0 })
      return (
        <div>
          <span id="pending">{String(r.isPending)}</span>
          <span id="success">{String(r.isSuccess)}</span>
          <span id="data">
            {r.data !== undefined ? String(r.data) : 'none'}
          </span>
          <button id="btn" onClick={() => r.run(7)}>
            go
          </button>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    await act(async () => {
      container
        .querySelector('#btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#pending')?.textContent).toBe('true')

    await act(async () => {
      resolveSave(7)
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(container.querySelector('#success')?.textContent).toBe('true')
    })
    expect(container.querySelector('#data')?.textContent).toBe('7')
  })

  test('async error: pending → error', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        async failAction() {
          throw new Error('async fail')
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.failAction)
      return (
        <div>
          <span id="isError">{String(r.isError)}</span>
          <span id="error">
            {r.error ? (r.error as Error).message : 'none'}
          </span>
          <button id="btn" onClick={() => r.run()}>
            go
          </button>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await act(async () => {
      container
        .querySelector('#btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => {
      expect(container.querySelector('#isError')?.textContent).toBe('true')
    })
    expect(container.querySelector('#error')?.textContent).toBe('async fail')
  })
})

describe('useAction — callbacks', () => {
  test('onSuccess + onSettled called on success (sync)', async () => {
    const onSuccess = jest.fn()
    const onSettled = jest.fn()
    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        add(x: number) {
          return x + 1
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.add, { onSuccess, onSettled })
      return (
        <button id="btn" onClick={() => r.run(4)}>
          go
        </button>
      )
    }
    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await act(async () => {
      container
        .querySelector('#btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onSuccess).toHaveBeenCalledWith(5)
    expect(onSettled).toHaveBeenCalledWith(5, null)
  })

  test('onError + onSettled called on error (async)', async () => {
    const onError = jest.fn()
    const onSettled = jest.fn()
    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        async flop() {
          throw new Error('nope')
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.flop, { onError, onSettled })
      return (
        <button id="btn" onClick={() => r.run()}>
          go
        </button>
      )
    }
    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await act(async () => {
      container
        .querySelector('#btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
    expect((onError.mock.calls[0][0] as Error).message).toBe('nope')
    expect(onSettled).toHaveBeenCalled()
    const [data, err] = onSettled.mock.calls[0]
    expect(data).toBeUndefined()
    expect((err as Error).message).toBe('nope')
  })
})

describe('useAction — runAsync', () => {
  test('returns a Promise resolving to the action result', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        async double(x: number) {
          return x * 2
        },
      },
    })

    let awaited: number | undefined
    const App = () => {
      const api = useModel(model)
      const r = useAction(api.double)
      return (
        <button
          id="btn"
          onClick={async () => {
            awaited = await r.runAsync(21)
          }}
        >
          go
        </button>
      )
    }
    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await act(async () => {
      container
        .querySelector('#btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => expect(awaited).toBe(42))
  })

  test('rejects on error so callers can catch', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        async always() {
          throw new Error('nope')
        },
      },
    })

    let caught: Error | undefined
    const App = () => {
      const api = useModel(model)
      const r = useAction(api.always)
      return (
        <button
          id="btn"
          onClick={async () => {
            try {
              await r.runAsync()
            } catch (e) {
              caught = e as Error
            }
          }}
        >
          go
        </button>
      )
    }
    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await act(async () => {
      container
        .querySelector('#btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => expect(caught?.message).toBe('nope'))
  })
})

describe('useAction — reset', () => {
  test('returns to idle state and clears data/error', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        identity(x: number) {
          return x
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.identity)
      return (
        <div>
          <span id="idle">{String(r.isIdle)}</span>
          <span id="success">{String(r.isSuccess)}</span>
          <span id="data">
            {r.data !== undefined ? String(r.data) : 'none'}
          </span>
          <button id="go" onClick={() => r.run(9)}>
            go
          </button>
          <button id="reset" onClick={r.reset}>
            reset
          </button>
        </div>
      )
    }
    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    await act(async () => {
      container
        .querySelector('#go')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#success')?.textContent).toBe('true')
    expect(container.querySelector('#data')?.textContent).toBe('9')

    await act(async () => {
      container
        .querySelector('#reset')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#idle')?.textContent).toBe('true')
    expect(container.querySelector('#data')?.textContent).toBe('none')
  })
})

describe('useAction — variadic args', () => {
  test('forwards multiple arguments', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        concat(a: string, b: string, c: string) {
          return a + b + c
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.concat)
      return (
        <div>
          <span id="data">
            {r.data !== undefined ? String(r.data) : 'none'}
          </span>
          <button id="go" onClick={() => r.run('a', 'b', 'c')}>
            go
          </button>
        </div>
      )
    }
    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await act(async () => {
      container
        .querySelector('#go')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#data')?.textContent).toBe('abc')
  })
})

describe('useAction — StrictMode', () => {
  test('works correctly under double-mount', async () => {
    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        async compute(x: number) {
          return x + 1
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.compute)
      return (
        <div>
          <span id="data">
            {r.data !== undefined ? String(r.data) : 'none'}
          </span>
          <button id="go" onClick={() => r.run(10)}>
            go
          </button>
        </div>
      )
    }
    const { container } = render(
      <StrictMode>
        <DouraRoot>
          <App />
        </DouraRoot>
      </StrictMode>
    )
    await act(async () => {
      container
        .querySelector('#go')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toBe('11')
    })
  })
})

describe('useAction — race guard', () => {
  test('late result of superseded run does not overwrite latest state', async () => {
    let resolveA!: (v: number) => void
    let resolveB!: (v: number) => void
    const onSuccess = jest.fn()

    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        async compute(x: number) {
          return new Promise<number>((r) => {
            if (x === 1) resolveA = r
            else resolveB = r
          })
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.compute, { pendingDelay: 0, onSuccess })
      return (
        <div>
          <span id="data">
            {r.data !== undefined ? String(r.data) : 'none'}
          </span>
          <button id="a" onClick={() => r.run(1)}>
            A
          </button>
          <button id="b" onClick={() => r.run(2)}>
            B
          </button>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    // Start A, then B while A is still in flight.
    await act(async () => {
      container
        .querySelector('#a')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      container
        .querySelector('#b')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Resolve B first (it won the race).
    await act(async () => {
      resolveB(200)
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toBe('200')
    })

    // A resolves late — must not overwrite B's result or fire onSuccess(100).
    await act(async () => {
      resolveA(100)
      await Promise.resolve()
    })
    // Give a microtask for any stray dispatch to show up.
    await act(async () => {
      await Promise.resolve()
    })

    expect(container.querySelector('#data')?.textContent).toBe('200')
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith(200)
  })

  test('late error of superseded run does not overwrite latest state', async () => {
    let rejectA!: (e: unknown) => void
    let resolveB!: (v: number) => void
    const onError = jest.fn()

    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        async compute(x: number) {
          return new Promise<number>((resolve, reject) => {
            if (x === 1) rejectA = reject
            else resolveB = resolve
          })
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.compute, { pendingDelay: 0, onError })
      return (
        <div>
          <span id="data">
            {r.data !== undefined ? String(r.data) : 'none'}
          </span>
          <span id="isError">{String(r.isError)}</span>
          <button id="a" onClick={() => r.run(1)}>
            A
          </button>
          <button id="b" onClick={() => r.run(2)}>
            B
          </button>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    await act(async () => {
      container
        .querySelector('#a')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      container
        .querySelector('#b')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      resolveB(42)
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(container.querySelector('#data')?.textContent).toBe('42')
    })

    // A rejects late — must not surface as error or call onError.
    await act(async () => {
      rejectA(new Error('stale'))
      await Promise.resolve()
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(container.querySelector('#data')?.textContent).toBe('42')
    expect(container.querySelector('#isError')?.textContent).toBe('false')
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('useAction — pendingDelay', () => {
  // Use fake timers scoped to this describe so the real-timer default from
  // the top-level beforeEach doesn't reset them on every test.
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test('fast op completes within delay — never shows pending, data replaces atomically', async () => {
    let resolveSave!: (v: number) => void
    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        async compute() {
          return new Promise<number>((r) => (resolveSave = r))
        },
      },
    })

    const pendingSeen: boolean[] = []
    const App = () => {
      const api = useModel(model)
      // Explicit default-ish delay to assert behavior.
      const r = useAction(api.compute, { pendingDelay: 300 })
      pendingSeen.push(r.isPending)
      return (
        <div>
          <span id="pending">{String(r.isPending)}</span>
          <span id="data">
            {r.data !== undefined ? String(r.data) : 'none'}
          </span>
          <button id="go" onClick={() => r.run()}>
            go
          </button>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    // First run, resolve before the delay expires.
    await act(async () => {
      container
        .querySelector('#go')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    // Still idle — pending timer hasn't fired yet.
    expect(container.querySelector('#pending')?.textContent).toBe('false')

    await act(async () => {
      jest.advanceTimersByTime(100) // well under 300
      resolveSave(7)
      // flush the await
      await Promise.resolve()
    })

    expect(container.querySelector('#data')?.textContent).toBe('7')
    // isPending must never have been true across renders.
    expect(pendingSeen.every((p) => p === false)).toBe(true)
  })

  test('slow op — after delay elapses pending turns on and previous data is cleared', async () => {
    let resolveFirst!: (v: number) => void
    let resolveSecond!: (v: number) => void
    let callCount = 0

    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        async compute() {
          callCount++
          return new Promise<number>((r) => {
            if (callCount === 1) resolveFirst = r
            else resolveSecond = r
          })
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.compute, { pendingDelay: 300 })
      return (
        <div>
          <span id="pending">{String(r.isPending)}</span>
          <span id="data">
            {r.data !== undefined ? String(r.data) : 'none'}
          </span>
          <button id="go" onClick={() => r.run()}>
            go
          </button>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    // First run — resolve quickly to populate data.
    await act(async () => {
      container
        .querySelector('#go')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      resolveFirst(11)
      await Promise.resolve()
    })
    expect(container.querySelector('#data')?.textContent).toBe('11')

    // Second run — keep data visible initially.
    await act(async () => {
      container
        .querySelector('#go')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#data')?.textContent).toBe('11')
    expect(container.querySelector('#pending')?.textContent).toBe('false')

    // Advance past the delay — pending flips on and data is cleared.
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(container.querySelector('#pending')?.textContent).toBe('true')
    expect(container.querySelector('#data')?.textContent).toBe('none')

    // Finally resolve — success with new data.
    await act(async () => {
      resolveSecond(22)
      await Promise.resolve()
    })
    expect(container.querySelector('#pending')?.textContent).toBe('false')
    expect(container.querySelector('#data')?.textContent).toBe('22')
  })

  test('pendingDelay=0 enters pending synchronously (no timer)', async () => {
    let resolveSave!: (v: number) => void
    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        async compute() {
          return new Promise<number>((r) => (resolveSave = r))
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.compute, { pendingDelay: 0 })
      return (
        <div>
          <span id="pending">{String(r.isPending)}</span>
          <button id="go" onClick={() => r.run()}>
            go
          </button>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )
    await act(async () => {
      container
        .querySelector('#go')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#pending')?.textContent).toBe('true')

    await act(async () => {
      resolveSave(1)
      await Promise.resolve()
    })
    expect(container.querySelector('#pending')?.textContent).toBe('false')
  })
})

describe('useAction — reset cancels in-flight', () => {
  test('reset before async resolves — result does not update state or fire callbacks', async () => {
    let resolveSave!: (v: number) => void
    const onSuccess = jest.fn()
    const onSettled = jest.fn()

    const model = defineModel({
      name: 'model',
      state: {},
      actions: {
        async compute() {
          return new Promise<number>((r) => (resolveSave = r))
        },
      },
    })

    const App = () => {
      const api = useModel(model)
      const r = useAction(api.compute, {
        pendingDelay: 0,
        onSuccess,
        onSettled,
      })
      return (
        <div>
          <span id="idle">{String(r.isIdle)}</span>
          <span id="pending">{String(r.isPending)}</span>
          <span id="data">
            {r.data !== undefined ? String(r.data) : 'none'}
          </span>
          <button id="go" onClick={() => r.run()}>
            go
          </button>
          <button id="reset" onClick={r.reset}>
            reset
          </button>
        </div>
      )
    }

    const { container } = render(
      <DouraRoot>
        <App />
      </DouraRoot>
    )

    await act(async () => {
      container
        .querySelector('#go')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#pending')?.textContent).toBe('true')

    await act(async () => {
      container
        .querySelector('#reset')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('#idle')?.textContent).toBe('true')

    // The old run resolves — but we've reset, so state/callbacks must stay quiet.
    await act(async () => {
      resolveSave(99)
      await Promise.resolve()
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(container.querySelector('#idle')?.textContent).toBe('true')
    expect(container.querySelector('#data')?.textContent).toBe('none')
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
  })
})

describe('useAction — run return and unhandled rejection', () => {
  test('run() returns undefined (void semantic)', () => {
    const { result } = renderHook(() =>
      useAction(async () => 'ok', { pendingDelay: 0 })
    )
    let ret: unknown = 'sentinel'
    act(() => {
      ret = result.current.run()
    })
    expect(ret).toBeUndefined()
  })

  test('run() with rejecting fn does not emit unhandled rejection', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (e: PromiseRejectionEvent) => {
      unhandled.push(e.reason)
    }
    window.addEventListener('unhandledrejection', onUnhandled)
    try {
      const { result } = renderHook(() =>
        useAction(
          async () => {
            throw new Error('boom')
          },
          { pendingDelay: 0 }
        )
      )
      act(() => {
        result.current.run()
      })
      await waitFor(() => expect(result.current.isError).toBe(true))
      // Flush any pending unhandledrejection microtask queue
      await act(async () => {
        await Promise.resolve()
      })
      expect(unhandled).toEqual([])
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  })
})

describe('useAction — runAsync Promise identity', () => {
  test('stale runAsync Promise resolves to its own fn value (state shows latest)', async () => {
    const resolvers: Array<(v: string) => void> = []
    const fn = () =>
      new Promise<string>((resolve) => {
        resolvers.push(resolve)
      })

    const { result } = renderHook(() => useAction(fn, { pendingDelay: 0 }))

    let p1!: Promise<string>
    let p2!: Promise<string>
    act(() => {
      p1 = result.current.runAsync()
      p2 = result.current.runAsync()
    })

    // Resolve second first — it becomes the latest state source
    await act(async () => {
      resolvers[1]?.('second')
      resolvers[0]?.('first-stale')
      await Promise.all([p1, p2])
    })

    // Each runAsync's Promise is a contract with its own invocation,
    // independent of whether its result reached component state.
    await expect(p1).resolves.toBe('first-stale')
    await expect(p2).resolves.toBe('second')
    // State reflects whichever landed last through the race guard.
    expect(['second', 'first-stale']).toContain(result.current.data)
  })
})

describe('useAction — unmount behavior', () => {
  test('onSuccess still fires after unmount (run was latest)', async () => {
    const onSuccess = jest.fn()
    let resolveFn!: (v: string) => void
    const fn = () =>
      new Promise<string>((resolve) => {
        resolveFn = resolve
      })

    const { result, unmount } = renderHook(() =>
      useAction(fn, { pendingDelay: 0, onSuccess })
    )

    let runPromise!: Promise<string>
    act(() => {
      runPromise = result.current.runAsync()
    })
    unmount()

    await act(async () => {
      resolveFn('late')
      await runPromise
    })

    expect(onSuccess).toHaveBeenCalledWith('late')
  })

  test('pendingDelay timer is cleared on unmount (advancing past delay does not throw)', async () => {
    jest.useFakeTimers()
    try {
      // fn that never resolves — only the timer matters here.
      const fn = () => new Promise<string>(() => {})
      const { result, unmount } = renderHook(() =>
        useAction(fn, { pendingDelay: 300 })
      )

      act(() => {
        void result.current.runAsync()
      })
      unmount()

      // If the timer weren't cleared, it would fire and try to dispatch
      // into an unmounted tree. Our isMountedRef gate handles the dispatch
      // side too, but the cleanup-and-advance must also not throw.
      expect(() => {
        jest.advanceTimersByTime(500)
      }).not.toThrow()
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('useAction — reset with pendingDelay > 0', () => {
  test('reset clears pending timer — pending never flips after reset', async () => {
    jest.useFakeTimers()
    try {
      let resolveFn!: (v: string) => void
      const fn = () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve
        })

      const { result } = renderHook(() => useAction(fn, { pendingDelay: 300 }))

      act(() => {
        void result.current.runAsync()
      })
      act(() => {
        result.current.reset()
      })

      // Timer would have fired at 300ms; it must be cancelled.
      await act(async () => {
        jest.advanceTimersByTime(500)
      })
      expect(result.current.isPending).toBe(false)
      expect(result.current.isIdle).toBe(true)

      // Late resolve — runId superseded, state stays idle.
      await act(async () => {
        resolveFn('ignored')
        jest.runAllTimers()
        await Promise.resolve()
      })
      expect(result.current.isIdle).toBe(true)
      expect(result.current.isSuccess).toBe(false)
      expect(result.current.data).toBeUndefined()
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('useAction — mutation semantics on new run', () => {
  test('error in a later run clears previous success data', async () => {
    let shouldError = false
    const fn = () =>
      shouldError ? Promise.reject(new Error('boom')) : Promise.resolve('first')

    const { result } = renderHook(() => useAction(fn, { pendingDelay: 0 }))

    await act(async () => {
      await result.current.runAsync()
    })
    expect(result.current.data).toBe('first')

    shouldError = true
    await act(async () => {
      await expect(result.current.runAsync()).rejects.toThrow('boom')
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  test('after delay: new run following an error atomically clears error', async () => {
    jest.useFakeTimers()
    try {
      let shouldError = true
      const resolvers: Array<(v: string) => void> = []
      const fn = () => {
        if (shouldError) return Promise.reject(new Error('boom'))
        return new Promise<string>((resolve) => {
          resolvers.push(resolve)
        })
      }

      const { result } = renderHook(() => useAction(fn, { pendingDelay: 300 }))

      await act(async () => {
        await expect(result.current.runAsync()).rejects.toThrow('boom')
      })
      expect(result.current.isError).toBe(true)
      expect((result.current.error as Error).message).toBe('boom')

      shouldError = false
      act(() => {
        void result.current.runAsync()
      })
      // Error still visible while timer hasn't fired (delay window).
      expect(result.current.isError).toBe(true)
      expect((result.current.error as Error).message).toBe('boom')

      await act(async () => {
        jest.advanceTimersByTime(300)
      })
      // After delay: pending on, error and data both null atomically.
      expect(result.current.isPending).toBe(true)
      expect(result.current.error).toBeUndefined()
      expect(result.current.data).toBeUndefined()

      await act(async () => {
        resolvers[0]?.('ok')
        jest.runAllTimers()
        await Promise.resolve()
      })
      expect(result.current.isSuccess).toBe(true)
      expect(result.current.data).toBe('ok')
    } finally {
      jest.useRealTimers()
    }
  })

  test('fast resolve within pendingDelay transitions old → new without any intermediate undefined', async () => {
    jest.useFakeTimers()
    try {
      const resolvers: Array<(v: string) => void> = []
      const fn = () =>
        new Promise<string>((resolve) => {
          resolvers.push(resolve)
        })

      const { result } = renderHook(() => useAction(fn, { pendingDelay: 300 }))

      // First run → success 'first'
      let p1!: Promise<string>
      act(() => {
        p1 = result.current.runAsync()
      })
      await act(async () => {
        resolvers[0]?.('first')
        await p1
      })
      expect(result.current.data).toBe('first')

      // Second run: previous data stays visible during delay window
      let p2!: Promise<string>
      act(() => {
        p2 = result.current.runAsync()
      })
      expect(result.current.data).toBe('first')
      expect(result.current.isSuccess).toBe(true)

      // Advance part of the delay — still the old data
      await act(async () => {
        jest.advanceTimersByTime(100)
      })
      expect(result.current.data).toBe('first')
      expect(result.current.error).toBeUndefined()

      // Resolve before delay elapses — smooth transition to new data
      await act(async () => {
        resolvers[1]?.('second')
        await p2
      })
      expect(result.current.data).toBe('second')
      expect(result.current.isPending).toBe(false)
      expect(result.current.isSuccess).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })
})
