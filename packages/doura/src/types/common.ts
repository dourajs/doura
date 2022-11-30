export type Objectish = AnyObject | AnyArray | AnyMap | AnySet
export type ObjectishNoSet = AnyObject | AnyArray | AnyMap

export type AnyObject = { [key: string]: any }
export type AnyArray = Array<any>
export type AnySet = Set<any>
export type AnyMap = Map<any, any>

export type CollectionTypes = Map<any, any> | Set<any>

export type EmptyObject = { [X: string | number | symbol]: never }

export interface Iterable {
  [Symbol.iterator](): Iterator
}

export interface Iterator {
  next(value?: any): IterationResult
}

export interface IterationResult {
  value: any
  done?: boolean
}
