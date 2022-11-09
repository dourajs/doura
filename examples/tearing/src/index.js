import ReactDOM from 'react-dom/client'

import { DouraRoot } from 'doura-react'

import App from './App'
import { douraStore } from './douraStore'

const rootElement = document.getElementById('root')
const root = ReactDOM.createRoot(rootElement)
root.render(
  <DouraRoot store={douraStore}>
    <App />
  </DouraRoot>
)
