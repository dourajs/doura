import getStorage from './getStorage'
import type { WebStorage } from '../types'

export default function createWebStorage(
  type: 'local' | 'session'
): WebStorage {
  const storage = getStorage(type)
  return {
    getItem: (key: string): Promise<string> => {
      return new Promise((resolve) => {
        resolve(storage.getItem(key))
      })
    },
    setItem: (key: string, item: string): Promise<void> => {
      return new Promise((resolve) => {
        resolve(storage.setItem(key, item))
      })
    },
    removeItem: (key: string): Promise<void> => {
      return new Promise((resolve) => {
        resolve(storage.removeItem(key))
      })
    },
  }
}
