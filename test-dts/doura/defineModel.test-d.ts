import { defineModel } from 'doura'
import { expectType } from '../helper'

// object model
const countModel = defineModel({
  name: 'test',
  state: {
    count: 0,
  },
  actions: {
    inc() {
      this.count += 1
    },
  },
  views: {
    double() {
      return this.count * 2
    },
  },
})

// @ts-expect-error — model name is required in object model options
defineModel({
  state: {},
})

// @ts-expect-error — function models were removed
defineModel(() => ({
  name: 'fn',
  state: {},
}))

// models
export const fooModel = defineModel({
  name: 'fooModel',
  state: {
    value: 0,
  },
  models: [countModel],
  actions: {
    accessDepend() {
      expectType<number>(this.test.count)
      // @ts-expect-error
      this.test.noExist
      expectType<number>(this.test.double)
      expectType<void>(this.test.inc())
    },
  },
})
