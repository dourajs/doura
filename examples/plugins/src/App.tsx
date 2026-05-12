import React from 'react'
import Basic from './components/Basic'
import { persistModel } from 'doura-plugin-persist'
import { useModel } from 'react-doura'

function App() {
  const { rehydrated } = useModel(persistModel)
  return (
    <>
      {rehydrated ? (
        <>
          <Basic />
        </>
      ) : (
        'isLoading'
      )}
    </>
  )
}

export default App
