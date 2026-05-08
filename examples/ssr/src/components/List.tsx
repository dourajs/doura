import * as React from 'react'
import { useModel } from 'react-doura'

import { list } from '../models/list'

function Count() {
  const listState = useModel(list)
  const [inputValue, setInputValue] = React.useState('')
  return (
    <div>
      <h3>todo list</h3>
      {listState.arr.map((item) => {
        return (
          <div key={item.id} style={{ padding: '5px' }}>
            <span>{`id:${item.id}-content:${item.content}`}</span>{' '}
            <button
              onClick={() => {
                listState.removeById(item.id)
              }}
            >
              remove
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
          listState.addContentAsync(inputValue)
          setInputValue('')
        }}
      >
        add content
      </button>
    </div>
  )
}

export default Count
