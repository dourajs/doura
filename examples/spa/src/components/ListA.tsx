import * as React from 'react'
import { useModel, useRootModel } from 'react-doura'
import { listA } from '../models/listA'
import { login } from '../models/login'

function ListA() {
  console.log('ListA rendered')
  const [{ arr }, { addContentAsync, removeById }] = useModel(listA)
  const [{ isLogin }] = useRootModel(login)
  const [inputValue, setInputValue] = React.useState('')
  return (
    <div>
      <h3>todo listA</h3>
      {arr.map((item) => {
        return (
          <div key={item.id} style={{ padding: '5px' }}>
            <span
              style={{
                color: isLogin ? 'black' : 'red',
                width: '200px',
                display: 'inline-block',
              }}
            >
              {isLogin ? `id:${item.id}-content:${item.content}` : 'need login'}
            </span>
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
        disabled={!isLogin && !!inputValue.length}
        style={{ paddingLeft: '10px', color: !isLogin ? 'red' : 'black' }}
        onClick={() => {
          const val = inputValue
          setInputValue('')
          addContentAsync(val)
        }}
      >
        add content {!isLogin ? '! need login' : ''}
      </button>
      <hr />
    </div>
  )
}

export default ListA
