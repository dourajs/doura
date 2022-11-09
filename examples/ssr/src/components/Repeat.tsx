// for ssr memory leak test
import * as React from 'react'
import { useModel } from 'doura-react'

import { local } from '../models/local'

const arr: number[] = []

for (let i = 0; i < 10; i++) {
  arr.push(i)
}

function Count() {
  const [{ value }] = useModel(local)
  return (
    <div>
      {arr.map((index) => {
        return (
          <div key={index}>
            <h1>Test local model: {index}</h1>
            <div>
              <h3>test: {value}</h3>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Count
