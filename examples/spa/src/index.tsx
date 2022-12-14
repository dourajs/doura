import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import { DouraRoot } from '../../../packages/react-doura/esm'

ReactDOM.render(
  <DouraRoot>
    <App></App>
  </DouraRoot>,
  document.getElementById('root')
)
