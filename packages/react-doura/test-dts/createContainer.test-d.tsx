import * as React from 'react'
import { defineModel } from 'doura'
import { createContainer, useStaticModel } from '../src/index'
import { UseNamedModel, UseStaticModel } from '../src/types'

import { expectType } from './index'

function Test() {
  const {
    Provider: _Provider,
    useSharedModel: _useSharedModel,
    useStaticModel: _useStaticModel,
  } = createContainer()

  const testElement = (
    <_Provider>
      <></>
    </_Provider>
  )
  expectType<JSX.Element>(testElement)
  expectType<UseNamedModel>(_useSharedModel)
  expectType<UseStaticModel>(_useStaticModel)

  const tempModel = defineModel({
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
  const model = useStaticModel('temp', tempModel)

  expectType<{ n: number; s: string }>(model.current.value)
  expectType<void>(model.add(1))
}
