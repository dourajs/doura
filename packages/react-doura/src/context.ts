import { createContext, useContext } from 'react'
import { Doura } from 'doura'
import { MISSING_PROVIDER_MESSAGE } from './errors'

export const DouraContext = createContext<{ store: Doura }>(null as any)

export function useDouraContext(): { store: Doura }
export function useDouraContext(options: {
  optional: true
}): { store: Doura } | null
export function useDouraContext(options?: { optional?: boolean }) {
  const context = useContext(DouraContext)

  if (__DEV__ && !context && !options?.optional) {
    throw new Error(MISSING_PROVIDER_MESSAGE)
  }
  return context
}
