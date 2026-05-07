export function describe(_name: string, _fn: () => void): void

type IsAny<T> = 0 extends 1 & T ? true : false
type ExpectTypeValue<T> = IsAny<T> extends true ? never : T

export function expectType<T>(value: ExpectTypeValue<T>): void
export function expectAny<T>(
  ...args: IsAny<T> extends true ? [] : [value: never]
): void
export function expectNotAny<T>(
  ...args: IsAny<T> extends true ? [value: never] : []
): void
export function expectError<T>(value: T): void
export function expectAssignable<T, T2 extends T = T>(value: T2): void
