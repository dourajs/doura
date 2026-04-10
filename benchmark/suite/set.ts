// @ts-nocheck
import { Suite } from 'benchmark'
import { produce, enableMapSet } from 'immer'
import { create } from 'mutative'
import { draft, snapshot } from '../../packages/doura'

enableMapSet()

const douraProduce = (value: any, cb: (v: any) => void) => {
  const obj = draft(value as any)
  cb(obj)
  return snapshot(obj, obj)
}

const run = (size: number) => {
  const getData = (size: number) =>
    new Set(
      Array(size)
        .fill(1)
        .map((_, key) => ({ value: key }))
    )

  const suite = new Suite()

  let i: number
  let baseState: Set<{ value: number }>

  suite
    .add(
      'Mutative',
      () => {
        const state = create(baseState, (draft) => {
          draft.values().next().value.value = i
        })
      },
      {
        onStart: () => {
          i = Math.random()
          baseState = getData(size)
        },
      }
    )
    .add(
      'Immer',
      () => {
        const state = produce(baseState, (draft: any) => {
          draft.values().next().value.value = i
        })
      },
      {
        onStart: () => {
          i = Math.random()
          baseState = getData(size)
        },
      }
    )
    .add(
      'Doura',
      () => {
        const state = douraProduce(baseState, (draft: any) => {
          draft.values().next().value.value = i
        })
      },
      {
        onStart: () => {
          i = Math.random()
          baseState = getData(size)
        },
      }
    )
    .on('cycle', (event: any) => {
      console.log(String(event.target))
    })
    .on('complete', function (this: any) {
      console.log(
        `Size ${size}: The fastest method is ${this.filter('fastest').map(
          'name'
        )}`
      )
    })
    .run({ async: false })
}

;[
  ...Array(9)
    .fill(1)
    .map((_, i) => (i + 1) * 10 ** 3),
  ...Array(9)
    .fill(1)
    .map((_, i) => (i + 1) * 10 ** 4),
]
  .sort((a, b) => a - b)
  .forEach((value) => run(value))
