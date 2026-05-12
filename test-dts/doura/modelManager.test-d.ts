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
expectType<number>(store.getModel(parentModel).$getApi().parentValue)
// @ts-expect-error — child models are not exposed in ModelAPI snapshots
store.getModel(parentModel).$getApi().test
// @ts-expect-error — child models are only available on ModelInstance.$models
store.getModel(parentModel).$getApi().$models
// @ts-expect-error — explicit name overloads were removed
store.getModel('test', model)
// @ts-expect-error — raw model options are not accepted at public boundary
store.getModel({ name: 'rawModel', state: { value: 0 } })
expectType<void>(store.destroy())
expectType<{ [modelName: string]: State }>(store.getState())
expectType<() => void>(store.subscribe(() => {}))
