import { invariant } from './utils'
import type { Plugin } from './core/index'

const reduxDevTools: Plugin = function () {
  let id = 0
  const unsubscribeSet = new Set<() => void>()
  return {
    onModelInstance(instance) {
      if (
        typeof window !== 'undefined' &&
        (window as any).__REDUX_DEVTOOLS_EXTENSION__
      ) {
        const devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__!.connect({
          name: instance.name || `model_${id++}`,
        })

        const initialState = instance.$rawState
        devTools.init(initialState)

        let isLatestState = true
        let latestState: any = instance.$rawState
        const fn = (message: any) => {
          switch (message.type) {
            case 'ACTION':
              invariant(
                typeof message.payload === 'string',
                'Unsupported action format'
              )
              // todo
              return
            case 'DISPATCH':
              switch (message.payload.type) {
                case 'RESET':
                  return devTools.init(instance.$rawState)

                case 'COMMIT':
                  isLatestState = true
                  return devTools.init(instance.$rawState)

                case 'ROLLBACK':
                  isLatestState = true
                  try {
                    const parsedState = JSON.parse(message.state)
                    instance.$state = parsedState
                    return devTools.init(instance.$rawState)
                  } catch (e) {
                    throw new Error(
                      `[Doura Devtool] Could not parse the received json.`
                    )
                  }

                case 'JUMP_TO_STATE':
                case 'JUMP_TO_ACTION':
                  try {
                    const parsedState = JSON.parse(message.state)
                    if (
                      JSON.stringify(parsedState) ===
                      JSON.stringify(latestState)
                    ) {
                      isLatestState = true
                    } else if (isLatestState) {
                      isLatestState = false
                      latestState = instance.$rawState
                    }
                    instance.$state = parsedState
                  } catch (e) {
                    throw new Error(
                      `[Doura Devtool] Could not parse the received json.`
                    )
                  }
                  return
              }
          }
        }
        const unsubscribe = devTools.subscribe(fn)
        unsubscribeSet.add(unsubscribe)

        instance.$onAction(() => {
          if (!isLatestState) {
            latestState = instance.$rawState
            devTools.send({} /* action */, latestState)
          }

          devTools.send({} /* action */, latestState)
        })
      }
    },
    onDestroy() {
      for (const fn of unsubscribeSet.values()) {
        fn()
      }
      unsubscribeSet.clear()
    },
  }
}

export default reduxDevTools
