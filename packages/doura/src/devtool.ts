import { invariant } from './utils'
import type { Plugin } from './core'
import { Doura } from './doura'

function applyState(newState: any, doura: Doura) {
  // todo
}

const reduxDevTools: Plugin = function () {
  if (
    typeof window === 'undefined' ||
    !(window as any).__REDUX_DEVTOOLS_EXTENSION__
  ) {
    return {}
  }

  let id = 0
  const unsubscribeSet = new Set<() => void>()
  let devTools: any
  return {
    onInit({ initialState }, { doura }) {
      ;(window as any).__doura = doura
      if (
        typeof window !== 'undefined' &&
        (window as any).__REDUX_DEVTOOLS_EXTENSION__
      ) {
        devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__!.connect({
          name: `doura${id === 0 ? '' : id}`,
        })
        id = id + 1
        devTools.init(doura.getState())

        const fn = (message: any) => {
          switch (message.type) {
            case 'ACTION':
              invariant(
                typeof message.payload === 'string',
                'Unsupported action format'
              )
              // do nothing
              return

            case 'DISPATCH':
              switch (message.payload.type) {
                case 'RESET':
                  // todo: model.reset()
                  return devTools.init(doura.getState())

                case 'COMMIT':
                  return devTools.init(doura.getState())

                case 'ROLLBACK':
                  try {
                    const state = JSON.parse(message.state)
                    applyState(state, doura)
                    return devTools.init(state)
                  } catch {
                    console.warn(
                      `[Doura Devtool] Could not parse the received json.`
                    )
                  }

                  return devTools.init(doura.getState())
                case 'JUMP_TO_STATE':
                case 'JUMP_TO_ACTION':
                  // try {
                  //   const state = JSON.parse(message.state)
                  //   // apply state
                  // } catch {
                  //   console.warn(
                  //     `[Doura Devtool] Could not parse the received json.`
                  //   )
                  // }
                  return
              }
          }
        }
        unsubscribeSet.add(devTools.subscribe(fn))
      }
    },
    onModelInstance(instance, { doura }) {
      instance.$subscribe(({ type, target, model, ...args }) => {
        const state = doura.getState()
        delete state._
        devTools.send(
          {
            type: `${model.$name || 'anonymous'}@${type}`,
            ...args,
          },
          state
        )
      })
    },
    onDestroy() {
      ;(window as any).__REDUX_DEVTOOLS_EXTENSION__!.disconnect(devTools)
      for (const fn of unsubscribeSet.values()) {
        fn()
      }
      unsubscribeSet.clear()
    },
  }
}

export default reduxDevTools
