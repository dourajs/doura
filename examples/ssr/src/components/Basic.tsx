import * as React from 'react'
import { useModel } from 'react-doura'

import { count } from '../models/count'

function Count() {
  const counter = useModel(count)
  return (
    <div>
      <h1>useModel basic use</h1>
      <div>
        <h3>count: {counter.value}</h3>
        <button onClick={() => counter.increment(1)}>Immer reducer +1</button>
        <button onClick={counter.incrementAsync}>Async action +1</button>
      </div>
      <hr />
    </div>
  )
}

export default Count
