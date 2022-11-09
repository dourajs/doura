import * as React from 'react'
import { defineModel, Action } from 'doura'
import { createContainer, useRootStaticModel } from '../src'

import { IUseModel, IUseStaticModel } from '../src/types'

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
  expectType<IUseModel>(_useSharedModel)
  expectType<IUseStaticModel>(_useStaticModel)

  const tempModel = defineModel({
    state: {
      value: {
        n: 1,
        s: '',
      },
    },
    reducers: {
      add(state, payload: number = 1) {
        state.value.n += payload
      },
    },
  })
  const [state, actions] = useRootStaticModel(tempModel)

  expectType<{ n: number; s: string }>(state.current.value)
  expectType<Action<number | undefined>>(actions.add())
}
