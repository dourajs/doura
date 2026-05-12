import * as React from 'react'
import { useModel } from 'react-doura'

import { count } from '../models/count'

function Count() {
  const counter = useModel(count)
  if (counter.value >= 5) {
    counter.value = 10
  }
  return (
    <div>
      <h1>useModel basic use</h1>
      <div>
        <h3>count: {counter.value}</h3>
        <button onClick={() => counter.add(1)}>Immer reducer +1</button>
        <button onClick={counter.addAsync}>Async action +1</button>
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

const a = {
  a: {
    b: 'c',
  },
}

deepFreeze(a)
deepFreeze(a)
a.a.b

export default Count
