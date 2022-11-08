import {
  defineModel,
  doura,
  expectType,
  DouraStore,
  ModelInstance,
  State,
} from './'

const douraStore = doura()

expectType<DouraStore>(douraStore)

const model = defineModel({
  name: 'model',
  state: 0,
})

expectType<ModelInstance<typeof model>>(douraStore.getModel(model))
expectType<void>(douraStore.destroy())
expectType<{ [modelName: string]: State }>(douraStore.getState())
expectType<() => void>(douraStore.subscribe(model, () => {}))
