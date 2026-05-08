import { defineModel, use } from 'doura'
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

// function model
const countModelFn = defineModel(() => {
  return {
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
  }
})

// @ts-expect-error — model name is required in object model options
defineModel({
  state: {},
})

// @ts-expect-error — model name is required in function model return options
defineModel(() => ({
  state: {},
}))

// use
export const fooModel = defineModel(() => {
  // local model
  const count = use(countModel)
  const count1 = use(countModelFn)
  // @ts-expect-error — explicit name overloads were removed
  use('test', countModel)

  return {
    name: 'fooModel',
    state: {
      value: 0,
    },
    actions: {
      accessDepend() {
        expectType<number>(count.count)
        // @ts-expect-error
        count.noExist
        expectType<number>(count.double)
        expectType<void>(count.inc())

        expectType<number>(count1.count)
        expectType<number>(count1.double)
        expectType<void>(count1.inc())
      },
    },
  }
})
