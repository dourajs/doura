import { createContext, useContext } from 'react'
import type { Doura } from 'doura'
import { assertDouraContext } from './errors'

export const DouraContext = createContext<{ store: Doura }>(null as any)

export function useDouraContext(): { store: Doura }
export function useDouraContext(options: {
  optional: true
}): { store: Doura } | null
export function useDouraContext(options?: { optional?: boolean }) {
  const context = useContext(DouraContext)

  if (!options?.optional) {
    assertDouraContext(context)
  }
  return context
}
