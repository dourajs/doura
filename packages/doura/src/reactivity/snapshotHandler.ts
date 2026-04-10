import { isObject, hasOwn, isMap } from '../utils'
import { AnyMap, CollectionTypes, Iterable, Iterator } from '../types'
import { isDraft, ReactiveFlags, getTargetType, TargetType } from './common'
import { DraftState } from './draft'

export type DraftSnapshot = {
  copies: Map<DraftState, any>
  snapshots: Map<any, any>
}

// WeakMap to associate a snapshot proxy's real target with its DraftSnapshot
// context. This avoids closure allocations in proxy handlers.
const snapshotCtxMap = new WeakMap<object, DraftSnapshot>()

function toSnapshot(value: any, ctx: DraftSnapshot): any {
  if (!isObject(value)) {
    return value
  }

  if (isDraft(value)) {
    const { copies, snapshots } = ctx
    let proxy = snapshots.get(value)
    if (!proxy) {
      const state: DraftState = value[ReactiveFlags.STATE]
      const resolved = copies.get(state) || state.base
      const targetType = getTargetType(resolved)
      const handler =
        targetType === TargetType.MAP || targetType === TargetType.SET
          ? collectionTraps
          : objectTraps
      snapshotCtxMap.set(resolved, ctx)
      snapshots.set(value, (proxy = new Proxy(resolved, handler)))
    }
    return proxy
  }

  return value
}

// --- Collection instrumentations (lazy, only when needed) ---

function collectionGet(this: AnyMap, key: unknown) {
  const proxied = this as any
  const target = proxied[ReactiveFlags.RAW]
  const ctx = snapshotCtxMap.get(target)!
  if (target.has(key)) {
    return toSnapshot(target.get(key), ctx)
  }
}

function collectionForEach(
  this: CollectionTypes,
  callback: Function,
  thisArg?: unknown
) {
  const proxied = this as any
  const target = proxied[ReactiveFlags.RAW]
  const ctx = snapshotCtxMap.get(target)!
  return target.forEach((value: unknown, key: unknown) => {
    value = toSnapshot(value, ctx)
    return callback.call(thisArg, value, isMap(target) ? key : value, target)
  })
}

function createNormalMethod(method: string) {
  return function (this: CollectionTypes, ...args: any[]) {
    const proxied = this as any
    const target = proxied[ReactiveFlags.RAW]
    return target[method](...args)
  }
}

function createIterableMethod(method: string | symbol) {
  return function (
    this: CollectionTypes,
    ...args: unknown[]
  ): Iterable & Iterator {
    const proxied = this as any
    const target = proxied[ReactiveFlags.RAW]
    const ctx = snapshotCtxMap.get(target)!
    const isPair =
      method === 'entries' || (method === Symbol.iterator && isMap(this))

    const innerIterator = target[method](...args)
    return {
      next() {
        const { value, done } = innerIterator.next()
        return done
          ? { value: toSnapshot(value, ctx), done }
          : {
              value: isPair
                ? [value[0], toSnapshot(value[1], ctx)]
                : toSnapshot(value, ctx),
              done,
            }
      },
      [Symbol.iterator]() {
        return this
      },
    }
  }
}

// Singleton collection instrumentations (allocated once at module load)
const collectionInstrumentations: Record<string | symbol, Function> =
  /*#__PURE__*/ (() => {
    const obj: Record<string | symbol, Function> = {
      get size() {
        const proxied = this as any
        const target = proxied[ReactiveFlags.RAW]
        return target.size
      },
      get: collectionGet,
      forEach: collectionForEach,
    }
    const normalMethods = ['has', 'add', 'set', 'delete', 'clear']
    for (let i = 0; i < normalMethods.length; i++) {
      obj[normalMethods[i]] = createNormalMethod(normalMethods[i])
    }
    const iteratorMethods: (string | symbol)[] = [
      'keys',
      'values',
      'entries',
      Symbol.iterator,
    ]
    for (let i = 0; i < iteratorMethods.length; i++) {
      obj[iteratorMethods[i] as string] = createIterableMethod(
        iteratorMethods[i]
      )
    }
    return obj
  })()

// --- Singleton proxy handlers (no per-call allocation) ---

const objectTraps: ProxyHandler<any> = {
  get(target, prop, receiver) {
    const ctx = snapshotCtxMap.get(target)!
    return toSnapshot(Reflect.get(target, prop, receiver), ctx)
  },
}

const collectionTraps: ProxyHandler<CollectionTypes> = {
  get(target: CollectionTypes, key: string | symbol, receiver: any) {
    if (key === ReactiveFlags.RAW) {
      return target
    }

    return Reflect.get(
      hasOwn(collectionInstrumentations, key) && key in target
        ? collectionInstrumentations
        : target,
      key,
      receiver
    )
  },
}

/**
 * Returns a singleton proxy handler for snapshot proxies.
 * The DraftSnapshot context is stored in a WeakMap keyed by the target,
 * avoiding closure allocations on every call.
 */
export function snapshotHandler(
  target: any,
  draftSnapshot: DraftSnapshot
): ProxyHandler<any> {
  snapshotCtxMap.set(target, draftSnapshot)
  const targetType = getTargetType(target)
  if (targetType === TargetType.MAP || targetType === TargetType.SET) {
    return collectionTraps
  }
  return objectTraps
}
