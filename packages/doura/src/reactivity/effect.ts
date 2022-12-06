import { TrackOpTypes, TriggerOpTypes } from './operations'
import { assign, isArray, isMap, isIntegerKey } from '../utils'
import { DraftState } from './draft'
import { ViewImpl, View } from './view'
import { ReactiveFlags, toBase } from './common'
import { EffectScope, recordEffectScope } from './effectScope'
import {
  Dep,
  createDep,
  initDepMarkers,
  finalizeDepMarkers,
  newTracked,
  wasTracked,
} from './dep'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()
const referenceMap = new WeakMap<any, Dep>()

// The number of effects currently being tracked recursively.
let effectTrackDepth = 0

export let trackOpBit = 1

/**
 * The bitwise track markers support at most 30 levels of recursion.
 * This value is chosen to enable modern JS engines to use a SMI on all platforms.
 * When recursion depth is greater, fall back to using a full cleanup.
 */
const maxMarkerBits = 30

export interface AccessRecord {
  type: TrackOpTypes | TriggerOpTypes
  value: any
}

export type KeyAccessNode = {
  parent: KeyAccessNode | null
  record: Map<any, AccessRecord>
  modified: boolean
  target: object
}

export type TargetRecord = Map<any, KeyAccessNode>

export type DraftMap = Map<any, any>

export type OriginMap = Map<any, any>

export type EffectScheduler = (...args: any[]) => any

export let activeEffect: ReactiveEffect | undefined

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '')

export const NODE_DELETE = Symbol('delete')

let uid = 0
export class ReactiveEffect<T = any> {
  id = uid++

  deps: Dep[] = []

  active = true

  parent: ReactiveEffect | undefined = undefined

  /**
   * Can be attached after creation
   * @internal
   */
  view?: ViewImpl<T>
  /**
   * @internal
   */
  allowRecurse?: boolean
  /**
   * @internal
   */
  private deferStop?: boolean

  onStop?: () => void

  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null,
    scope?: EffectScope
  ) {
    recordEffectScope(this, scope)
  }

  run() {
    if (!this.active) {
      return this.fn()
    }
    let parent: ReactiveEffect | undefined = activeEffect
    let lastShouldTrack = shouldTrack
    while (parent) {
      if (parent === this) {
        return
      }
      parent = parent.parent
    }
    try {
      this.parent = activeEffect
      activeEffect = this
      // console.log('enter effect', this)
      shouldTrack = true

      trackOpBit = 1 << ++effectTrackDepth

      if (effectTrackDepth <= maxMarkerBits) {
        initDepMarkers(this)
      } else {
        cleanupEffect(this)
      }

      return this.fn()
    } finally {
      if (effectTrackDepth <= maxMarkerBits) {
        finalizeDepMarkers(this)
      }

      trackOpBit = 1 << --effectTrackDepth

      // console.log('exit effect', this)
      activeEffect = this.parent
      shouldTrack = lastShouldTrack
      this.parent = undefined

      if (this.deferStop) {
        this.stop()
      }
    }
  }

  stop() {
    // stopped while running itself - defer the cleanup
    if (activeEffect === this) {
      this.deferStop = true
    } else if (this.active) {
      cleanupEffect(this)
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

export interface ReactiveEffectOptions {
  lazy?: boolean
  scheduler?: EffectScheduler
  scope?: EffectScope
  allowRecurse?: boolean
  onStop?: () => void
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions
): ReactiveEffectRunner {
  if ((fn as ReactiveEffectRunner).effect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }

  const _effect = new ReactiveEffect(fn)
  if (options) {
    assign(_effect, options)
    if (options.scope) recordEffectScope(_effect, options.scope)
  }
  if (!options || !options.lazy) {
    _effect.run()
  }
  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner
  runner.effect = _effect
  return runner
}

export function stop(runner: ReactiveEffectRunner) {
  runner.effect.stop()
}

export let shouldTrack = true
const trackStack: boolean[] = []

export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }

    trackEffects(dep)
  }
}

export function trackDraft(target: any) {
  if (shouldTrack && activeEffect) {
    const state = target[ReactiveFlags.STATE]
    if (!state) {
      return
    }

    let dep = referenceMap.get(state)
    if (!dep) {
      referenceMap.set(state, (dep = createDep()))
    }

    trackEffects(dep)
  }
}

export function trackEffects(dep: Dep) {
  let shouldTrack = false
  if (effectTrackDepth <= maxMarkerBits) {
    if (!newTracked(dep)) {
      dep.n |= trackOpBit // set newly tracked
      shouldTrack = !wasTracked(dep)
    }
  } else {
    // Full cleanup mode.
    shouldTrack = !dep.has(activeEffect!)
  }

  if (shouldTrack) {
    dep.add(activeEffect!)
    activeEffect!.deps.push(dep)
  }
}

export function trackView(view: View<any>) {
  if (shouldTrack && activeEffect) {
    view = toBase(view)
    trackEffects(view.dep || (view.dep = createDep()))
  }
}

export function triggerView(view: View<any>, newVal?: any) {
  view = toBase(view)
  if (view.dep) {
    triggerEffects(view.dep)
  }
}

function triggerDraftChange(state: DraftState) {
  const referenceDeps = referenceMap.get(state)
  if (referenceDeps) {
    const effects = [...referenceDeps]
    for (const effect of effects) {
      if (effect.view) {
        effect.view.mightChange = true
      }
    }
  }
}

export function triggerDraft(state: DraftState) {
  let current: DraftState | undefined = state
  while (current) {
    triggerDraftChange(current)
    current = current.parent
  }
}

export function trigger(
  state: DraftState,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown
) {
  const depsMap = targetMap.get(state)
  const target = state.base
  let deps: (Dep | undefined)[] = []
  if (depsMap) {
    if (type === TriggerOpTypes.CLEAR) {
      // collection being cleared
      // trigger all effects for target
      deps = [...depsMap.values()]
    } else if (key === 'length' && isArray(target)) {
      depsMap.forEach((dep, key) => {
        if (key === 'length' || key >= (newValue as number)) {
          deps.push(dep)
        }
      })
    } else {
      // schedule runs for SET | ADD | DELETE
      if (key !== void 0) {
        deps.push(depsMap.get(key))
      }

      // also run for iteration key on ADD | DELETE | Map.SET
      switch (type) {
        case TriggerOpTypes.ADD:
          if (!isArray(target)) {
            deps.push(depsMap.get(ITERATE_KEY))
            if (isMap(target)) {
              deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
            }
          } else if (isIntegerKey(key)) {
            // new index added to array -> length changes
            deps.push(depsMap.get('length'))
          }
          break
        case TriggerOpTypes.DELETE:
          if (!isArray(target)) {
            deps.push(depsMap.get(ITERATE_KEY))
            if (isMap(target)) {
              deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
            }
          }
          break
        case TriggerOpTypes.SET:
          if (isMap(target)) {
            deps.push(depsMap.get(ITERATE_KEY))
          }
          break
      }
    }
  }

  if (deps.length === 1) {
    if (deps[0]) {
      triggerEffects(deps[0])
    }
  } else {
    const effects: ReactiveEffect[] = []
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }
    triggerEffects(createDep(effects))
  }

  // trigger draft listeners
  const listeners = state.root?.listeners
  if (listeners && listeners.length) {
    listeners.forEach((listener) => listener())
  }
}

export function triggerEffects(dep: Dep | ReactiveEffect[]) {
  // spread into array for stabilization
  const effects = isArray(dep) ? dep : [...dep]
  for (const effect of effects) {
    if (effect.view) {
      triggerEffect(effect)
    }
  }
  for (const effect of effects) {
    if (!effect.view) {
      triggerEffect(effect)
    }
  }
}

function triggerEffect(effect: ReactiveEffect) {
  if (effect !== activeEffect || effect.allowRecurse) {
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
}
