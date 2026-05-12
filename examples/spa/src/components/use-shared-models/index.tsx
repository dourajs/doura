import { count } from '../../models/count'

import { LocalProviderA, useSharedModelA } from './AShared'
import { LocalProviderB, useSharedModelB } from './BShared'

const C = () => {
  const stateA = useSharedModelA(count)
  const stateB = useSharedModelB(count)

  return (
    <>
      <div id="stateCA">stateCA: {stateA.value}</div>
      <div id="stateCB">stateCB: {stateB.value}</div>
    </>
  )
}

const A = () => {
  const state = useSharedModelA(count)

  return (
    <>
      <div id="stateA">stateA: {state.value}</div>
      <button id="buttonA" type="button" onClick={() => state.add(1)}>
        A add
      </button>
      <C></C>
    </>
  )
}

const B = () => {
  const state = useSharedModelB(count)

  return (
    <>
      <div id="stateB">stateB: {state.value}</div>
      <button id="buttonB" type="button" onClick={() => state.add(1)}>
        B add
      </button>
      <C></C>
    </>
  )
}

export { LocalProviderA, LocalProviderB, A, B, C }
