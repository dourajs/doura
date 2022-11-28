import { isObject } from '../utils'
import { isDraft, ReactiveFlags } from './common'
import { DraftState } from './draft'

export type DraftSnapshot = Map<DraftState, any>

export function snapshotHandler(snapshot: DraftSnapshot) {
  const proxyMap = new WeakMap<any, any>()

  const objectTraps: ProxyHandler<any> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (!isObject(value)) {
        return value
      }

      if (isDraft(value)) {
        let proxy = proxyMap.get(value)
        if (!proxy) {
          proxyMap.set(
            value,
            (proxy = new Proxy(
              snapshot.get(value[ReactiveFlags.STATE]),
              objectTraps
            ))
          )
        }

        return proxy
      }

      return value
    },
    set(
      target,
      prop: string /* strictly not, but helps TS */,
      value,
      receiver
    ) {
      const result = Reflect.set(target, prop, value, receiver)
      return result
    },
    has(target, prop) {
      const result = Reflect.has(target, prop)
      return result
    },
    ownKeys(target) {
      return Reflect.ownKeys(target)
    },
  }

  return objectTraps
}
