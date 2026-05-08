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

const namedModel = defineModel({
  name: 'named',
  state: {
    value: 0,
  },
})

const functionModel = defineModel(() => ({
  state: {
    value: 0,
  },
}))

const tModel = store.getModel('test', model)
const implicitNamedModel = store.getModel(namedModel)

// store apis
expectType<ModelPublicInstance<typeof model>>(tModel)
expectType<ModelPublicInstance<typeof namedModel>>(implicitNamedModel)
// @ts-expect-error — getModel(model) requires defineModel({ name, ... })
store.getModel(model)
// @ts-expect-error — implicit name lookup is object-model only
store.getModel(functionModel)
expectType<void>(store.destroy())
expectType<{ [modelName: string]: State }>(store.getState())
expectType<() => void>(store.subscribe(() => {}))
