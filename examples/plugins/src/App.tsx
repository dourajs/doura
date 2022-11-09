import React from 'react'
import Basic from './components/Basic'
import { persistModel } from 'doura-persist'
import { useRootModel } from 'doura-react'

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
