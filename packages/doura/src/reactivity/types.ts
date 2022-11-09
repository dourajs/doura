export type Objectish = AnyObject | AnyArray | AnyMap | AnySet
export type ObjectishNoSet = AnyObject | AnyArray | AnyMap

export type AnyObject = { [key: string]: any }
export type AnyArray = Array<any>
export type AnySet = Set<any>
export type AnyMap = Map<any, any>
