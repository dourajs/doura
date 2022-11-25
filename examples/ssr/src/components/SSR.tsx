import * as React from 'react'
import { useRootModel } from 'react-doura'

import { test } from '../models/test'
import { count } from '../models/count'

function Count() {
  const [{ value }, { increment, incrementAsync }] = useRootModel(count)
  const [{ value: testString }, _] = useRootModel(test)
  return (
    <div>
      <h1>SSR data form server</h1>
      <div>
        <h3>test: {testString}</h3>
      </div>
      <div>
        <h3>count: {value}</h3>
        <button onClick={() => increment(1)}>Immer reducer +1</button>
        <button onClick={incrementAsync}>Async action +1</button>
      </div>
      <hr />
    </div>
  )
}

export default Count
