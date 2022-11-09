import * as React from 'react'
import { useModel } from 'doura-react'

import { count } from '../models/count'

function Count() {
  const [state, { add, addAsync }] = useModel(count)
  if (state.value >= 5) {
    state.value = 10
  }
  return (
    <div>
      <h1>useModel basic use</h1>
      <div>
        <h3>count: {state.value}</h3>
        <button onClick={() => add(1)}>Immer reducer +1</button>
        <button onClick={addAsync}>Async action +1</button>
      </div>
      <hr />
    </div>
  )
}

const deepFreeze = (obj: any) => {
  if (typeof obj !== 'object' || obj === null) return
  Object.freeze(obj)
  const propNames = Object.getOwnPropertyNames(obj)
  for (const name of propNames) {
    const value = obj[name]
    deepFreeze(value)
  }
  return obj
}

let a = {
  a: {
    b: 'c',
  },
}

deepFreeze(a)
deepFreeze(a)
a.a.b

export default Count
