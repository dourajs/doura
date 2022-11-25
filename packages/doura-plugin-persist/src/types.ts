export interface IStorageState {
  [key: string]: any
}

export interface PersistOptions {
  storage: Storage
  key: string
  blacklist?: Array<string>
  whitelist?: Array<string>
  throttle?: number
  version?: number
  migrate?: <S = any>(persistedState: S, version: number) => S | Promise<S>
  writeFailHandler?: (err: Error) => void
}

export interface Storage {
  getItem(key: string, ...args: Array<any>): Promise<any>
  setItem(key: string, value: any, ...args: Array<any>): Promise<any>
  removeItem(key: string, ...args: Array<any>): Promise<any>
}

export interface WebStorage extends Storage {
  /**
   * @desc Fetches key and returns item in a promise.
   */
  getItem(key: string): Promise<string | null>
  /**
   * @desc Sets value for key and returns item in a promise.
   */
  setItem(key: string, item: string): Promise<void>
  /**
   * @desc Removes value for key.
   */
  removeItem(key: string): Promise<void>
}
