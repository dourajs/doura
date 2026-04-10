// @ts-nocheck
import { Suite } from 'benchmark'
import { produce } from 'immer'
import { create } from 'mutative'
import { draft, snapshot } from '../../packages/doura'

const douraProduce = (value: any, cb: (v: any) => void) => {
  const obj = draft(value as any)
  cb(obj)
  return snapshot(obj, obj)
}

const run = (size: number) => {
  const MODIFY_FACTOR = 0.1
  const getData = (size: number) =>
    Array(size)
      .fill(1)
      .map((_, key) => ({ value: key }))

  const suite = new Suite()

  let i: number
  let baseState: { value: number }[]

  suite
    .add(
      'Mutative',
      () => {
        const state = create(baseState, (draft) => {
          for (let index = 0; index < size * MODIFY_FACTOR; index++) {
            draft[index].value = i
          }
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
          for (let index = 0; index < size * MODIFY_FACTOR; index++) {
            draft[index].value = i
          }
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
          for (let index = 0; index < size * MODIFY_FACTOR; index++) {
            draft[index].value = i
          }
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
  ...Array(1)
    .fill(1)
    .map((_, i) => (1 + i * 4) * 10 ** 3),
  ...Array(1)
    .fill(1)
    .map((_, i) => (1 + i * 4) * 10 ** 4),
]
  .sort((a, b) => a - b)
  .forEach((value) => run(value))
