import * as React from 'react'
import { useModel } from 'react-doura'

import { count } from '../models/count'
import A from './A'
import B from './B'

function Count() {
  const counter = useModel(count)
  return (
    <div>
      <h1>useModel basic use</h1>
      <div>
        <h3>count: {counter.value}</h3>
        <button onClick={() => counter.add(1)}>Immer reducer +1</button>
        <button onClick={counter.addAsync}>Async effect +1</button>
      </div>
      <hr />
      <A />
      <B />
    </div>
  )
}

export default Count
