import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import { doura } from 'doura'
import douraLog from 'doura-log'
import persist, { createWebStorage } from 'doura-persist'
import { DouraRoot } from 'react-doura'

const douraStore = doura({
  initialState: {},
  plugins: [
    [douraLog],
    [
      persist,
      {
        key: 'root',
        storage: createWebStorage('local'),
        // whitelist: ['b'],
        blacklist: ['b'],
        migrate: function (storageState: any, version: number) {
          const count = storageState.count
          if (count && count.value >= 3) {
            count.value = 2
          }
          return storageState
        },
      },
    ],
  ],
})

ReactDOM.render(
  <DouraRoot store={douraStore}>
    <App></App>
  </DouraRoot>,
  document.getElementById('root')
)
