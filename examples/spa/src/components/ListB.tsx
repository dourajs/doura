import * as React from 'react'
import { ModelData } from 'doura'
import { useModel } from 'doura-react'

import { listB } from '../models/listB'
export type selectorParameters = ModelData<typeof listB>

const selector = function (stateAndViews: selectorParameters) {
  return {
    arr: stateAndViews.arr,
    current: stateAndViews.current,
  }
}

function ListB() {
  console.log('ListB rendered')
  const [{ arr, current }, { addContentAsync, choose }] = useModel(
    listB,
    selector
  )
  const [inputValue, setInputValue] = React.useState('')
  return (
    <div>
      <h2>
        <strong>current: {current}</strong>
      </h2>
      <h3>todo listB</h3>
      {arr.map((item) => {
        return (
          <div key={item.id} style={{ padding: '5px' }}>
            <span
              style={{
                width: '200px',
                display: 'inline-block',
              }}
            >
              {`id1:${item.id}-content:${item.item}`}
            </span>
            <button
              onClick={() => {
                choose(item.id)
              }}
            >
              choose
            </button>
          </div>
        )
      })}
      <input
        value={inputValue}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setInputValue(e.target.value)
        }
      />

      <button
        style={{ paddingLeft: '10px' }}
        onClick={() => {
          const val = inputValue
          setInputValue('')
          addContentAsync(val)
        }}
      >
        add content
      </button>
      <hr />
    </div>
  )
}

export default ListB
