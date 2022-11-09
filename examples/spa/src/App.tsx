import React from 'react'
import Basic from './components/Basic'
import Views from './components/Views'
import Login from './components/Login'
import LoginStatic from './components/LoginStatic'
import ListA from './components/ListA'
import ListB from './components/ListB'
import Fetch from './components/FetchData'
import Isolation from './components/Isolation'
import Shared from './components/Shared'

function App() {
  const [show, setShow] = React.useState(true)
  return (
    <>
      <button onClick={() => setShow(!show)}>toggle unmount</button>
      <hr />
      {show ? (
        <>
          <Basic />
          <Views />
          <Login />
          <LoginStatic />
          <ListA />
          <ListB />
          <Fetch />
          <h3>Isolation useSharedModel</h3>
          <Isolation></Isolation>
          <hr />
          <h3>Shared useSharedModel</h3>
          <Shared></Shared>
        </>
      ) : null}
    </>
  )
}

export default App
