import React from 'react'
import SSR from './components/SSR'
import Basic from './components/Basic'
import Views from './components/Views'
import List from './components/List'
import Repeat from './components/Repeat'
import type { Doura } from 'doura'
import { DouraRoot } from 'react-doura'

function App(props: { store?: Doura }) {
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
