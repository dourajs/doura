import { defineModel } from 'doura'
import { test } from './test'

export const local = defineModel({
  name: 'local',
  models: [test],
  state: { value: 'localValue' },
  actions: {
    setLocal(payload: string) {
      this.value = payload
    },
  },
})
