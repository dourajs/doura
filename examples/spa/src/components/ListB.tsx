import * as React from 'react'
import { ModelAPI } from 'doura'
import { useModel } from 'react-doura'

import { listB } from '../models/listB'
export type selectorParameters = ModelAPI<typeof listB>

const selector = function (stateAndViews: selectorParameters) {
  return {
    arr: stateAndViews.arr,
    current: stateAndViews.current,
    addContentAsync: stateAndViews.addContentAsync,
    choose: stateAndViews.choose,
  }
}

function ListB() {
  console.log('ListB rendered')
  const list = useModel(listB, selector)
  const [inputValue, setInputValue] = React.useState('')
  return (
    <div>
      <h2>
        <strong>current: {list.current}</strong>
      </h2>
      <h3>todo listB</h3>
      {list.arr.map((item) => {
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
                list.choose(item.id)
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
          list.addContentAsync(val)
        }}
      >
        add content
      </button>
      <hr />
    </div>
  )
}

export default ListB
