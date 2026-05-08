import * as React from 'react'
import { useModel } from 'react-doura'

import { a } from '../models/a'

function A() {
  const state = useModel(a)
  return (
    <div>
      <h1>useModel a</h1>
      <div>
        <h3>a: {state.a}</h3>
        <button onClick={() => state.add(1)}>Immer reducer +1</button>
        <button onClick={state.addAsync}>Async effect +1</button>
      </div>
      <hr />
    </div>
  )
}

export default A
