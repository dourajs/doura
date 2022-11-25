import React from 'react'
import Basic from './components/Basic'
import { persistModel } from 'doura-persist'
import { useRootModel } from 'react-doura'

function App() {
  const [{ rehydrated }] = useRootModel(persistModel)
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
