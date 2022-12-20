import { defineModel, use } from 'doura'
import { expectType } from '../helper'

// object model
const countModel = defineModel({
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

// use
export const fooModel = defineModel(() => {
  // local model
  const count = use(countModel)
  const count1 = use(countModelFn)
  // named model
  const count2 = use('test', countModel)
  const count3 = use('test', countModelFn)

  return {
    state: {
      value: 0,
    },
    actions: {
      accessDepend() {
        expectType<number>(count.count)
        expectType<number>(count.double)
        expectType<void>(count.inc())

        expectType<number>(count1.count)
        expectType<number>(count1.double)
        expectType<void>(count1.inc())

        expectType<number>(count2.count)
        expectType<number>(count2.double)
        expectType<void>(count2.inc())

        expectType<number>(count3.count)
        expectType<number>(count3.double)
        expectType<void>(count3.inc())
      },
    },
  }
})
