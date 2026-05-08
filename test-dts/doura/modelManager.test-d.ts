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
  name: 'test',
  state: {
    value: 0,
  },
})

const namedModel = defineModel({
  name: 'named',
  state: {
    value: 0,
  },
})

const functionModel = defineModel(() => ({
  name: 'functionModel',
  state: {
    value: 0,
  },
}))

const tModel = store.getModel(model)
const implicitNamedModel = store.getModel(namedModel)

// store apis
expectType<ModelPublicInstance<typeof model>>(tModel)
expectType<ModelPublicInstance<typeof namedModel>>(implicitNamedModel)
expectType<ModelPublicInstance<typeof functionModel>>(
  store.getModel(functionModel)
)
// @ts-expect-error — explicit name overloads were removed
store.getModel('test', model)
expectType<void>(store.destroy())
expectType<{ [modelName: string]: State }>(store.getState())
expectType<() => void>(store.subscribe(() => {}))
