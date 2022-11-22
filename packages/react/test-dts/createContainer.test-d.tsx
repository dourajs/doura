import * as React from 'react'
import { defineModel } from 'doura'
import { createContainer, useRootStaticModel } from '../src'
import { IUseSharedModel, IUseStaticModel } from '../src/types'

import { expectType } from './'

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
  expectType<IUseSharedModel>(_useSharedModel)
  expectType<IUseStaticModel>(_useStaticModel)

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
  const [state, actions] = useRootStaticModel(tempModel)

  expectType<{ n: number; s: string }>(state.current.value)
  expectType<void>(actions.add(1))
}
