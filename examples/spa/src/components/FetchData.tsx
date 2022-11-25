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
  }
}

const fetchBSelector = function (stateAndViews: fetchBSelectorParams) {
  return {
    data: stateAndViews.data,
    isLoading: stateAndViews.isLoading,
  }
}

function Fetch() {
  const [{ data: Adata, isLoading: isALoading }, { fetchAData }] = useModel(
    fetchA,
    fetchASelector
  )
  const [{ data: Bdata, isLoading: isBLoading }, { fetchBData }] = useModel(
    fetchB,
    fetchBSelector
  )
  return (
    <div>
      <h3>fetch example</h3>
      <div>
        <div>{isALoading ? 'A is loading' : JSON.stringify(Adata)}</div>
        <button onClick={() => fetchAData('string')}>fetchAData</button>
      </div>
      <div>
        <div>{isBLoading ? 'B is loading' : JSON.stringify(Bdata)}</div>
        <button onClick={() => fetchBData(1)}>fetchBData</button>
      </div>
      <hr />
    </div>
  )
}

export default Fetch
