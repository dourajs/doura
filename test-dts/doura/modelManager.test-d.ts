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

const parentModel = defineModel({
  name: 'parent',
  state: {
    parentValue: 0,
  },
  models: [model],
})

const tModel = store.getModel(model)
const implicitNamedModel = store.getModel(namedModel)

// store apis
expectType<ModelPublicInstance<typeof model>>(tModel)
expectType<ModelPublicInstance<typeof namedModel>>(implicitNamedModel)
expectType<ModelPublicInstance<typeof parentModel>>(store.getModel(parentModel))
expectType<ModelPublicInstance<typeof model>>(store.getModel(parentModel).test)
expectType<ModelPublicInstance<typeof model>>(
  store.getModel(parentModel).$models.test
)
expectType<number>(store.getModel(parentModel).test.value)
// @ts-expect-error — explicit name overloads were removed
store.getModel('test', model)
// @ts-expect-error — function models were removed
store.getModel(() => ({ name: 'functionModel', state: { value: 0 } }))
expectType<void>(store.destroy())
expectType<{ [modelName: string]: State }>(store.getState())
expectType<() => void>(store.subscribe(() => {}))
