import * as React from 'react'
import { useRootModel } from 'react-doura'

import { b } from '../models/b'

function B() {
  const [state, { add, addAsync }] = useRootModel(b)
  return (
    <div>
      <h1>useModel b</h1>
      <div>
        <h3>b: {state.b}</h3>
        <button onClick={() => add(1)}>Immer reducer +1</button>
        <button onClick={addAsync}>Async effect +1</button>
      </div>
      <hr />
    </div>
  )
}

export default B
