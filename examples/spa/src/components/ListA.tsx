import * as React from 'react'
import { useModel } from 'react-doura'
import { listA } from '../models/listA'
import { login } from '../models/login'

function ListA() {
  console.log('ListA rendered')
  const list = useModel(listA)
  const loginState = useModel(login)
  const [inputValue, setInputValue] = React.useState('')
  return (
    <div>
      <h3>todo listA</h3>
      {list.arr.map((item) => {
        return (
          <div key={item.id} style={{ padding: '5px' }}>
            <span
              style={{
                color: loginState.isLogin ? 'black' : 'red',
                width: '200px',
                display: 'inline-block',
              }}
            >
              {loginState.isLogin
                ? `id:${item.id}-content:${item.content}`
                : 'need login'}
            </span>
            <button
              onClick={() => {
                list.removeById(item.id)
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
        disabled={!loginState.isLogin && !!inputValue.length}
        style={{
          paddingLeft: '10px',
          color: !loginState.isLogin ? 'red' : 'black',
        }}
        onClick={() => {
          const val = inputValue
          setInputValue('')
          list.addContentAsync(val)
        }}
      >
        add content {!loginState.isLogin ? '! need login' : ''}
      </button>
      <hr />
    </div>
  )
}

export default ListA
