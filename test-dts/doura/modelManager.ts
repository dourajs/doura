import {
  defineModel,
  doura,
  ModelManager,
  ModelPublicInstance,
  State,
} from 'doura'
import { expectType } from '../helper'

const store = doura()

expectType<ModelManager>(store)

const model = defineModel({
  state: {
    value: 0,
  },
})

expectType<ModelPublicInstance<typeof model>>(store.getModel('test', model))
expectType<void>(store.destroy())
expectType<{ [modelName: string]: State }>(store.getState())
expectType<() => void>(store.subscribe(() => {}))
