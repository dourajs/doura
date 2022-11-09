import * as React from 'react'
import { useModel } from 'doura-react'

import { list } from '../models/list'

function Count() {
  const [{ arr }, { addContentAsync, removeById }] = useModel(list)
  const [inputValue, setInputValue] = React.useState('')
  return (
    <div>
      <h3>todo list</h3>
      {arr.map((item) => {
        return (
          <div key={item.id} style={{ padding: '5px' }}>
            <span>{`id:${item.id}-content:${item.content}`}</span>{' '}
            <button
              onClick={() => {
                removeById(item.id)
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
          addContentAsync(inputValue)
          setInputValue('')
        }}
      >
        add content
      </button>
    </div>
  )
}

export default Count
