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

const tModel = store.getModel('test', model)

// store apis
expectType<ModelPublicInstance<typeof model>>(tModel)
expectType<void>(store.destroy())
expectType<{ [modelName: string]: State }>(store.getState())
expectType<() => void>(store.subscribe(() => {}))
