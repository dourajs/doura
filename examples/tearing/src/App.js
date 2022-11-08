import { defineModel } from 'doura'
import { useEffect, useState, startTransition } from 'react'
import { useRootModel } from 'doura-react'
import { douraStore } from './douraStore'

let externalState = { counter: 0 }
let listeners = []

function dispatch(action) {
  if (action.type === 'increment') {
    externalState = { counter: externalState.counter + 1 }
  } else {
    throw Error('Unknown action')
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn) {
  listeners = [...listeners, fn]
  return () => {
    listeners = listeners.filter((f) => f !== fn)
  }
}

function useExternalData() {
  const [state, setState] = useState(externalState)
  useEffect(() => {
    const handleChange = () => setState(externalState)
    const unsubscribe = subscribe(handleChange)
    return unsubscribe
  }, [])
  return state
}

// setInterval(() => {
// 	dispatch({ type: 'increment' })
// }, 50)

// function SlowComponent() {
// 	let now = performance.now()
// 	while (performance.now() - now < 200) {
// 		// do nothing
// 	}
// 	const state = useExternalData()
// 	return <h3>Counter: {state.counter}</h3>
// }

export default function App() {
  const [show, setShow] = useState(false)
  return (
    <div className="App">
      <button
        onClick={() => {
          startTransition(() => {
            setShow(!show)
          })
        }}
      >
        toggle content
      </button>
      {show && (
        <>
          <SlowComponent />
          <SlowComponent />
          <SlowComponent />
          <SlowComponent />
          <SlowComponent />
        </>
      )}
    </div>
  )
}

const counterModel = defineModel({
  name: 'counter',
  state: {
    counter: 0,
  },
  actions: {
    increment() {
      this.counter += 1
    },
  },
})

const counterStore = douraStore.getModel(counterModel)

window.counterStore = counterStore

setInterval(() => {
  counterStore.increment()
}, 50)

function SlowComponent() {
  let now = performance.now()
  while (performance.now() - now < 200) {
    // do nothing
  }
  const [state] = useRootModel(counterModel)
  return <h3>Counter: {state.counter}</h3>
}
