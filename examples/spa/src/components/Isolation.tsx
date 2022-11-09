import * as React from 'react'
import { LocalProviderA, LocalProviderB, A, B } from './use-shared-models'

function Isolation() {
  return (
    <LocalProviderA>
      <LocalProviderB>
        <A></A>
        <B></B>
      </LocalProviderB>
    </LocalProviderA>
  )
}

export default Isolation
