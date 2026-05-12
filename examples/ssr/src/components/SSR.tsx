import * as React from 'react'
import { useModel } from 'react-doura'

import { test } from '../models/test'
import { count } from '../models/count'

function Count() {
  const counter = useModel(count)
  const testState = useModel(test)
  return (
    <div>
      <h1>SSR data form server</h1>
      <div>
        <h3>test: {testState.value}</h3>
      </div>
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
