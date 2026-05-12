import { defineModel } from 'doura'
import {
  createContainer,
  useStaticModel,
  UseSharedModel,
  UseStaticModel,
} from 'react-doura'
import { expectType } from '../helper'

export function Test() {
  const {
    Provider: _Provider,
    useSharedModel: _useSharedModel,
    useStaticModel: _useStaticModel,
  } = createContainer()

  expectType<UseSharedModel>(_useSharedModel)
  expectType<UseStaticModel>(_useStaticModel)

  const tempModel = defineModel({
    name: 'temp',
    state: {
      value: {
        n: 1,
        s: '',
      },
    },
    actions: {
      add(payload: number = 1) {
        this.value.n += payload
      },
    },
  })
  const model = useStaticModel(tempModel)

  // useStaticModel returns the ModelAPI directly; state is accessed by key.
  // (The previous `.current` indirection type-checked only because a leaked
  // index signature in ModelAPI made any property access widen to any.)
  expectType<{ n: number; s: string }>(model.value)
  expectType<void>(model.add(1))
}
