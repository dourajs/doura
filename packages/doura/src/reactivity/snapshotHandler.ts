import { isObject, hasOwn, isMap } from '../utils'
import { AnyMap, CollectionTypes, Iterable, Iterator } from '../types'
import { isDraft, ReactiveFlags, getTargetType, TargetType } from './common'
import { DraftState } from './draft'

export type DraftSnapshot = {
  copies: Map<DraftState, any>
  snapshots: Map<any, any>
}

export function snapshotHandler(
  target: any,
  { copies, snapshots }: DraftSnapshot
) {
  const getHandlers = (target: any) => {
    switch (getTargetType(target)) {
      case TargetType.COMMON:
      case TargetType.ARRAY:
        return objectTraps
      case TargetType.MAP:
      case TargetType.SET:
        return collectionTraps
      default:
        throw new Error(
          'Unpected Error. Please file an issue on https://github.com/dourajs/doura'
        )
    }
  }

  const toSnapshot = (value: any) => {
    if (!isObject(value)) {
      return value
    }

    if (isDraft(value)) {
      let proxy = snapshots.get(value)
      if (!proxy) {
        const target = copies.get(value[ReactiveFlags.STATE])
        snapshots.set(value, (proxy = new Proxy(target, getHandlers(target))))
      }

      return proxy
    }

    return value
  }

  const createIterableMethod = (method: string | symbol) => {
    return function (
      this: CollectionTypes,
      ...args: unknown[]
    ): Iterable & Iterator {
      const proxied = this as any
      const target = proxied[ReactiveFlags.RAW]
      const isPair =
        method === 'entries' || (method === Symbol.iterator && isMap(this))

      const innerIterator = target[method](...args)
      return {
        // iterator protocol
        next() {
          const { value, done } = innerIterator.next()
          return done
            ? { value: toSnapshot(value), done }
            : {
                value: isPair
                  ? [value[0], toSnapshot(value[1])]
                  : toSnapshot(value),
                done,
              }
        },
        // iterable protocol
        [Symbol.iterator]() {
          return this
        },
      }
    }
  }

  const createNormalMethod = (method: string) => {
    return function (this: CollectionTypes, ...args: any[]) {
      const proxied = this as any
      const target = proxied[ReactiveFlags.RAW]
      return target[method](...args)
    }
  }

  const collectionInstrumentations: Record<string, Function> = {
    get size() {
      const proxied = this as any
      const target = proxied[ReactiveFlags.RAW]
      return target.size
    },
    get(this: AnyMap, key: unknown) {
      const proxied = this as any
      const target = proxied[ReactiveFlags.RAW]
      if (target.has(key)) {
        return toSnapshot(target.get(key))
      }
    },
    forEach(this: CollectionTypes, callback: Function, thisArg?: unknown) {
      const proxied = this as any
      const target = proxied[ReactiveFlags.RAW]
      return target.forEach((value: unknown, key: unknown) => {
        value = toSnapshot(value)
        return callback.call(
          thisArg,
          value,
          isMap(target) ? key : value,
          target
        )
      })
    },
  }

  const normalMethods = ['has', 'add', 'set', 'delete', 'clear']
  normalMethods.forEach((method) => {
    collectionInstrumentations[method as string] = createNormalMethod(method)
  })
  const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
  iteratorMethods.forEach((method) => {
    collectionInstrumentations[method as string] = createIterableMethod(method)
  })

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

  const objectTraps: ProxyHandler<any> = {
    get(target, prop, receiver) {
      return toSnapshot(Reflect.get(target, prop, receiver))
    },
  }

  return getHandlers(target)
}
