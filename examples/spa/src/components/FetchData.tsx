import * as React from 'react'
import { ModelAPI } from 'doura'
import { useModel } from 'react-doura'

import { fetchA, fetchB } from '../models/fetchData'

export type fetchASelectorParams = ModelAPI<typeof fetchA>
export type fetchBSelectorParams = ModelAPI<typeof fetchB>

const fetchASelector = function (stateAndViews: fetchASelectorParams) {
  return {
    data: stateAndViews.data,
    isLoading: stateAndViews.isLoading,
    fetchAData: stateAndViews.fetchAData,
  }
}

const fetchBSelector = function (stateAndViews: fetchBSelectorParams) {
  return {
    data: stateAndViews.data,
    isLoading: stateAndViews.isLoading,
    fetchBData: stateAndViews.fetchBData,
  }
}

function Fetch() {
  const fetchAState = useModel(fetchA, fetchASelector)
  const fetchBState = useModel(fetchB, fetchBSelector)
  return (
    <div>
      <h3>fetch example</h3>
      <div>
        <div>
          {fetchAState.isLoading
            ? 'A is loading'
            : JSON.stringify(fetchAState.data)}
        </div>
        <button onClick={() => fetchAState.fetchAData('string')}>
          fetchAData
        </button>
      </div>
      <div>
        <div>
          {fetchBState.isLoading
            ? 'B is loading'
            : JSON.stringify(fetchBState.data)}
        </div>
        <button onClick={() => fetchBState.fetchBData(1)}>fetchBData</button>
      </div>
      <hr />
    </div>
  )
}

export default Fetch
