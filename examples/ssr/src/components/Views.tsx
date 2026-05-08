import React, { useState } from 'react'
import { defineModel, ModelAPI } from 'doura'
import { useModel } from 'react-doura'

const otherDep = defineModel({
  name: 'otherDep',
  state: {
    other: ['other'],
  },
  actions: {
    add(step: string = 'other') {
      this.other = [...this.other, step]
    },
  },
})

const domeDep = defineModel({
  name: 'domeDep',
  state: {
    dome: 0,
  },
  actions: {
    add(step: number = 1) {
      this.dome += step
    },
  },
})

const user = defineModel({
  name: 'user',
  models: [otherDep, domeDep],
  state: {
    value: 1,
    value1: 1,
  },
  actions: {
    add(step: number = 1) {
      this.value += step
    },
    add1(step: number = 1) {
      this.value1 += step
    },
  },
  views: {
    viewValue1() {
      console.log('viewValue1 computed')
      return this.value1
    },
    viewDome() {
      console.log('viewDome computed')
      return this.domeDep.dome
    },
  },
})

export type userSelectorParameters = ModelAPI<typeof user>

const selector = function (stateAndViews: userSelectorParameters) {
  return {
    v: stateAndViews.viewValue1,
    d: stateAndViews.viewDome,
    add: stateAndViews.add,
    add1: stateAndViews.add1,
  }
}

export default function Views() {
  const [index, setIndex] = useState(0)
  const other = useModel(otherDep)
  const dome = useModel(domeDep)
  const views = useModel(user, selector)

  return (
    <div>
      <h1>Views</h1>
      <div>
        views automatic collect dependencies of state what it used. if state not
        changed, views will not be computed.
      </div>
      <div>
        <div>computed by 'state.value1', views.v: {views.v}</div>
        <div>computed by 'dependsState.domeDep.dome', views.d: {views.d}</div>
        <hr />
      </div>
      <button
        onClick={() => {
          views.add(1)
        }}
      >
        changed user value
      </button>
      <button
        onClick={() => {
          views.add1(1)
        }}
      >
        changed user value1
      </button>
      <hr />
      {JSON.stringify({ dome: dome.dome })}
      <hr />
      <button
        onClick={() => {
          dome.add(1)
        }}
      >
        trigger dome actions
      </button>
      <hr />
      {JSON.stringify({ other: other.other })}
      <hr />
      <button
        onClick={() => {
          other.add()
        }}
      >
        trigger other actions
      </button>
      <div id="index">useState index: {index}</div>
      <button
        onClick={() => {
          setIndex(index + 1)
        }}
      >
        trigger useState
      </button>
      <hr />
    </div>
  )
}
