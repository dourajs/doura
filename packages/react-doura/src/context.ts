import { createContext, useContext } from 'react'
import { Doura } from 'doura'

export const DouraContext = createContext<{ store: Doura }>(null as any)

export const useDouraContext = () => {
  const context = useContext(DouraContext)

  if (__DEV__ && !context) {
    throw new Error(
      `[react-doura]: could not find react-doura context value; please ensure the component is wrapped in a <Provider>.`
    )
  }
  return context
}
