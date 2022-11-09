import React from 'react'
import SSR from './components/SSR'
import Basic from './components/Basic'
import Views from './components/Views'
import List from './components/List'
import Repeat from './components/Repeat'
import type { DouraStore } from 'doura'
import { DouraRoot } from 'doura-react'

function App(props: { store?: DouraStore }) {
  return (
    <>
      <DouraRoot {...props}>
        <SSR />
        <Basic />
        <Views />
        <List />
        <Repeat />
      </DouraRoot>
    </>
  )
}

export default App
