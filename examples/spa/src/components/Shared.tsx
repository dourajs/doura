import * as React from 'react'
import { doura } from 'doura'
import { LocalProviderA, LocalProviderB, A, B } from './use-shared-models'

const douraStore0 = doura()
const douraStore1 = doura()

function Shared() {
  let [data, setState] = React.useState(false)
  return (
    <>
      <button
        onClick={() => {
          setState(!data)
        }}
      >
        toggledouraStore {data}
      </button>
      <LocalProviderA store={data ? douraStore0 : douraStore1}>
        <LocalProviderB store={data ? douraStore0 : douraStore1}>
          <A></A>
          <B></B>
        </LocalProviderB>
      </LocalProviderA>
    </>
  )
}

export default Shared
