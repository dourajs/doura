export type Objectish = AnyObject | AnyArray | AnyMap | AnySet

export type AnyObject = { [key: string]: any }
export type AnyArray = Array<any>
export type AnySet = Set<any>
export type AnyMap = Map<any, any>

export type CollectionTypes = Map<any, any> | Set<any>

export interface Iterable {
  [Symbol.iterator](): Iterator
}

export interface Iterator {
  next(value?: any): { value: any; done?: boolean }
}
