import { isObject } from '../utils'
import { isDraft, ReactiveFlags } from './common'
import { DraftState } from './draft'

export type DraftSnapshot = {
  copies: Map<DraftState, any>
  proxies: Map<any, any>
}

export function snapshotHandler({ copies, proxies }: DraftSnapshot) {
  const objectTraps: ProxyHandler<any> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (!isObject(value)) {
        return value
      }

      if (isDraft(value)) {
        let proxy = proxies.get(value)
        if (!proxy) {
          proxies.set(
            value,
            (proxy = new Proxy(
              copies.get(value[ReactiveFlags.STATE]),
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
