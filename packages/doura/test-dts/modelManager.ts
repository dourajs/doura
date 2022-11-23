import {
  defineModel,
  doura,
  expectType,
  ModelManager,
  ModelPublicInstance,
  State,
} from './index'

const store = doura()

expectType<ModelManager>(store)

const model = defineModel({
  state: 0,
})

expectType<ModelPublicInstance<typeof model>>(store.getModel('test', model))
expectType<void>(store.destroy())
expectType<{ [modelName: string]: State }>(store.getState())
expectType<() => void>(store.subscribe(() => {}))
