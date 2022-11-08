import * as React from 'react'
import { useRootModel } from 'doura-react'

import { a } from '../models/a'

function A() {
  const [state, { add, addAsync }] = useRootModel(a)
  return (
    <div>
      <h1>useModel a</h1>
      <div>
        <h3>a: {state.a}</h3>
        <button onClick={() => add(1)}>Immer reducer +1</button>
        <button onClick={addAsync}>Async effect +1</button>
      </div>
      <hr />
    </div>
  )
}

export default A
