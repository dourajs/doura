import { defineModel, doura } from 'doura'
import { expectType } from '../helper'

const douraStore = doura()

interface State {
  count: number
}

const model = defineModel({
  state: {
    count: 0,
  },
})

const store = douraStore.getModel('test', model)

// props
expectType<State>(store.$state)

// state can be access from inst directly
expectType<number>(store.count)
