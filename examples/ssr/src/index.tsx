import React from 'react'
import { hydrateRoot } from 'react-dom/client'
import App from './App'
import { doura } from 'doura'

let douraStore

if (window.clientEnv) {
  douraStore = doura({
    initialState: window.clientEnv,
  })
} else {
  douraStore = doura()
}

const container = document.getElementById('root')

hydrateRoot(
  container!,
  <React.StrictMode>
    <App store={douraStore}></App>
  </React.StrictMode>
)
