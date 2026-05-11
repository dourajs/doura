import { useCallback, useEffect, useReducer, useRef } from 'react'
import { DOURA_ACTION_REF, type InternalActionDefinitionRef } from 'doura'
import { useDouraContext } from './context'
import { assertDouraContext } from './errors'

export interface UseActionOptions<TData> {
  onSuccess?: (data: TData) => void
  onError?: (error: unknown) => void
  onSettled?: (data: TData | undefined, error: unknown | null) => void
  /**
   * Delay in milliseconds before transitioning to the `pending` state on a
   * new async run. Within this window the previous settled state
   * (`data` / `error`) stays visible, so fast operations transition
   * old → new directly with no loading flash. When the delay elapses, and
   * only if this run is still the latest, `isPending` flips to true AND
   * previous `data` / `error` are cleared atomically (mutation semantics).
   *
   * Does not apply to synchronous actions (which never enter pending).
   * Default: 300. Set to 0 to flip and clear immediately.
   */
  pendingDelay?: number
}

type ActionStatus = 'idle' | 'pending' | 'success' | 'error'

interface ActionState<TData> {
  status: ActionStatus
  data: TData | undefined
  error: unknown
}

type ActionEvent<TData> =
  | { type: 'pending-enter' }
  | { type: 'success'; data: TData }
  | { type: 'error'; error: unknown }
  | { type: 'reset' }

const IDLE_STATE: ActionState<any> = {
  status: 'idle',
  data: undefined,
  error: undefined,
}

const DEFAULT_PENDING_DELAY = 300

function reducer<TData>(
  _state: ActionState<TData>,
  event: ActionEvent<TData>
): ActionState<TData> {
  switch (event.type) {
    case 'pending-enter':
      // Mutation semantics: entering pending clears previous settled state
      // so consumers see the operation as a clean restart.
      return { status: 'pending', data: undefined, error: undefined }
    case 'success':
      return { status: 'success', data: event.data, error: undefined }
    case 'error':
      return { status: 'error', data: undefined, error: event.error }
    case 'reset':
      return IDLE_STATE as ActionState<TData>
  }
}

export interface UseActionResult<TFn extends (...args: any[]) => any> {
  /**
   * Fire-and-forget. Returns void; rejections are swallowed so callers can
   * invoke without `.catch(...)`. State (`error`, `isError`) and callbacks
   * (`onError`, `onSettled`) still fire as usual.
   */
  run: (...args: Parameters<TFn>) => void
  /**
   * Returns a Promise that resolves with the action's data on success, or
   * rejects on failure. Use when the caller needs the return value or
   * explicit try/catch control flow.
   */
  runAsync: (...args: Parameters<TFn>) => Promise<Awaited<ReturnType<TFn>>>
  data: Awaited<ReturnType<TFn>> | undefined
  error: unknown
  isIdle: boolean
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  reset: () => void
}

function isThenable(x: unknown): x is PromiseLike<unknown> {
  return (
    x !== null &&
    typeof x === 'object' &&
    typeof (x as { then?: unknown }).then === 'function'
  )
}

function noop(): void {
  /* swallow — error is already captured in state */
}

function resolveAction<TFn extends (...args: any[]) => any>(
  action: TFn,
  context: { store: any } | null
): TFn {
  const ref = (action as InternalActionDefinitionRef<TFn>)?.[DOURA_ACTION_REF]
  if (!ref) {
    return action
  }
  return assertDouraContext(context).store.getModel(ref.model)[
    ref.actionName
  ] as TFn
}

/**
 * Tracks the lifecycle of calling an action function from React.
 *
 * Semantics:
 * - Synchronous actions (return a non-thenable) skip pending entirely —
 *   the reducer jumps straight from idle/previous to success/error in one
 *   batch, so `isPending` is never observed true for them.
 * - Async actions follow a mutation model with a configurable
 *   `pendingDelay`: during the window the previous settled state remains
 *   visible (no flash for fast operations); after the window, and only if
 *   the run is still the latest, state is cleared and `isPending` flips
 *   to true. On resolve/reject, if the run is still the latest, state is
 *   replaced with success/error.
 *
 * Race handling:
 * - Every call to `run`/`runAsync` gets a unique runId. Only the most
 *   recent run is allowed to write state or fire callbacks — earlier
 *   in-flight runs are abandoned when a newer one starts or reset() is
 *   called. This prevents stale results from overwriting the UI after
 *   rapid successive invocations.
 *
 * State is local to each hook instance — two components using useAction
 * on the same action track independently. For cross-component
 * coordination put the state in the model itself.
 */
export function useAction<TFn extends (...args: any[]) => any>(
  action: TFn,
  options?: UseActionOptions<Awaited<ReturnType<TFn>>>
): UseActionResult<TFn> {
  const context = useDouraContext({ optional: true })
  const resolvedAction = resolveAction(action, context)
  const [state, dispatch] = useReducer(
    reducer as (
      s: ActionState<Awaited<ReturnType<TFn>>>,
      e: ActionEvent<Awaited<ReturnType<TFn>>>
    ) => ActionState<Awaited<ReturnType<TFn>>>,
    IDLE_STATE as ActionState<Awaited<ReturnType<TFn>>>
  )

  // Latest action/options captured via refs so the returned callbacks keep
  // stable identity across renders while still seeing current values.
  const actionRef = useRef(resolvedAction)
  actionRef.current = resolvedAction
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Race guard — only runId === runIdRef.current is allowed to write state
  // or fire callbacks. Incremented on every run() and on reset().
  const runIdRef = useRef(0)
  // Mount guard — React 19+ already no-ops post-unmount setState, but the
  // explicit ref documents intent and covers older React + future changes.
  const isMountedRef = useRef(true)
  // pendingDelay timer handle; cancelled on new run, success/error landing,
  // reset(), and unmount.
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPendingTimer = () => {
    if (pendingTimerRef.current !== null) {
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: clearPendingTimer only reads and writes refs.
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      clearPendingTimer()
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: callback reads latest action/options through refs.
  const runAsync = useCallback(
    async (...args: Parameters<TFn>): Promise<Awaited<ReturnType<TFn>>> => {
      const runId = ++runIdRef.current
      // A new run always supersedes any pending-delay timer from a previous
      // run. If we're the outermost call in a sequence the clear is a no-op.
      clearPendingTimer()

      let result: unknown
      try {
        result = (actionRef.current as TFn)(...args)
      } catch (syncError) {
        if (runIdRef.current === runId) {
          if (isMountedRef.current) {
            dispatch({ type: 'error', error: syncError })
          }
          optionsRef.current?.onError?.(syncError)
          optionsRef.current?.onSettled?.(undefined, syncError)
        }
        throw syncError
      }

      if (!isThenable(result)) {
        // Synchronous success path — no pending, no timer, atomic replace.
        const data = result as Awaited<ReturnType<TFn>>
        if (runIdRef.current === runId) {
          if (isMountedRef.current) {
            dispatch({ type: 'success', data })
          }
          optionsRef.current?.onSuccess?.(data)
          optionsRef.current?.onSettled?.(data, null)
        }
        return data
      }

      // Async path — schedule (or skip) the pending-enter transition.
      const delay = optionsRef.current?.pendingDelay ?? DEFAULT_PENDING_DELAY
      if (delay <= 0) {
        if (isMountedRef.current) dispatch({ type: 'pending-enter' })
      } else {
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null
          if (runIdRef.current === runId && isMountedRef.current) {
            dispatch({ type: 'pending-enter' })
          }
        }, delay)
      }

      try {
        const data = (await result) as Awaited<ReturnType<TFn>>
        if (runIdRef.current === runId) {
          clearPendingTimer()
          if (isMountedRef.current) {
            dispatch({ type: 'success', data })
          }
          optionsRef.current?.onSuccess?.(data)
          optionsRef.current?.onSettled?.(data, null)
        }
        return data
      } catch (asyncError) {
        if (runIdRef.current === runId) {
          clearPendingTimer()
          if (isMountedRef.current) {
            dispatch({ type: 'error', error: asyncError })
          }
          optionsRef.current?.onError?.(asyncError)
          optionsRef.current?.onSettled?.(undefined, asyncError)
        }
        throw asyncError
      }
    },
    []
  )

  const run = useCallback(
    (...args: Parameters<TFn>): void => {
      runAsync(...args).catch(noop)
    },
    [runAsync]
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: clearPendingTimer only reads and writes refs.
  const reset = useCallback(() => {
    // Invalidate any in-flight run so its eventual resolution cannot leak
    // into state or callbacks.
    runIdRef.current++
    clearPendingTimer()
    dispatch({ type: 'reset' })
  }, [])

  return {
    run,
    runAsync,
    data: state.data,
    error: state.error,
    isIdle: state.status === 'idle',
    isPending: state.status === 'pending',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    reset,
  }
}
