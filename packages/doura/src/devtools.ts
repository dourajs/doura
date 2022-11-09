import { invariant } from './utils'
import type { Plugin } from './core/index'

const SET_FROM_DEVTOOLS = '@@doura/SET_FROM_DEVTOOLS'

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

        const initialState = instance.getState()
        devTools.init(initialState)

        let isLatestState = true
        let latestState: any = instance.getState()
        const fn = (message: any) => {
          switch (message.type) {
            case 'ACTION':
              invariant(
                typeof message.payload === 'string',
                'Unsupported action format'
              )
              try {
                const action = JSON.parse(message.payload)
                return instance.dispatch(action)
              } catch (e) {
                throw new Error(
                  `[Doura Devtool] Could not parse the received json.`
                )
              }

            case 'DISPATCH':
              switch (message.payload.type) {
                case 'RESET':
                  return devTools.init(instance.getState())

                case 'COMMIT':
                  isLatestState = true
                  return devTools.init(instance.getState())

                case 'ROLLBACK':
                  isLatestState = true
                  try {
                    const parsedState = JSON.parse(message.state)
                    const action = {
                      type: SET_FROM_DEVTOOLS,
                      payload: parsedState,
                    }
                    instance.dispatch(action)
                    return devTools.init(instance.getState())
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
                      latestState = instance.getState()
                    }
                    const action = {
                      type: SET_FROM_DEVTOOLS,
                      payload: parsedState,
                    }
                    return instance.dispatch(action)
                  } catch (e) {
                    throw new Error(
                      `[Doura Devtool] Could not parse the received json.`
                    )
                  }
              }
              return
          }
        }
        const unsubscribe = devTools.subscribe(fn)
        unsubscribeSet.add(unsubscribe)

        const originReducer = instance.reducer
        instance.reducer = function (state, action) {
          if (action.type === SET_FROM_DEVTOOLS) {
            return action.payload
          }
          if (!isLatestState) {
            const newState = originReducer(latestState, action)
            latestState = newState
            devTools.send(action, newState)
            return state
          }
          const newState = originReducer(state, action)
          devTools.send(action, newState)
          return newState
        }
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
