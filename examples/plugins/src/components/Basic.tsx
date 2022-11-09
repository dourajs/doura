import * as React from 'react'
import { useRootModel } from 'doura-react'

import { count } from '../models/count'
import A from './A'
import B from './B'

function Count() {
  const [{ value }, { add, addAsync }] = useRootModel(count)
  return (
    <div>
      <h1>useModel basic use</h1>
      <div>
        <h3>count: {value}</h3>
        <button onClick={() => add(1)}>Immer reducer +1</button>
        <button onClick={addAsync}>Async effect +1</button>
      </div>
      <hr />
      <A />
      <B />
    </div>
  )
}

export default Count
