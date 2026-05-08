import { defineModel, doura, ModelManager, ModelInstance, State } from 'doura'
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
expectType<ModelInstance<typeof model>>(tModel)
expectType<ModelInstance<typeof namedModel>>(implicitNamedModel)
expectType<ModelInstance<typeof parentModel>>(store.getModel(parentModel))
expectType<ModelInstance<typeof model>>(store.getModel(parentModel).test)
expectType<ModelInstance<typeof model>>(
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
