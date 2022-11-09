export type Objectish = AnyObject | AnyArray | AnyMap | AnySet
export type ObjectishNoSet = AnyObject | AnyArray | AnyMap

export type AnyObject = { [key: string]: any }
export type AnyArray = Array<any>
export type AnySet = Set<any>
export type AnyMap = Map<any, any>

export type EmptyObject = { [X: string | number | symbol]: never }

export type Tuple<T> = T extends [any, ...any] ? T : []

// transform depends start
export namespace Math {
  export type Num<T> = Extract<T, number>
  type Length<T extends any[]> = T['length']
  type Push<T extends any[], Val> = [...T, Val]
  export type NTuple<
    N extends number,
    T extends any[] = []
  > = T['length'] extends N ? T : NTuple<N, Push<T, any>>

  export type Add<A extends number, B extends number> = Length<
    [...NTuple<A>, ...NTuple<B>]
  >
  export type Sub<A extends number, B extends number> = NTuple<A> extends [
    ...infer U,
    ...NTuple<B>
  ]
    ? Length<U>
    : never
}
