import { expectAny, expectNotAny, expectType } from './helper'

expectAny<any>()
expectNotAny<unknown>()
expectNotAny<string>()

// @ts-expect-error expectAny<T>() only accepts any.
expectAny<string>()

// @ts-expect-error expectNotAny<T>() rejects any.
expectNotAny<any>()

// @ts-expect-error use expectAny<T>() for explicit any assertions.
expectType<any>(undefined as any)
