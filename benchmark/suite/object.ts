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
  const getData = (size: number) =>
    Array(size)
      .fill(1)
      .reduce(
        (acc, _, key) => Object.assign(acc, { [`key${key}`]: key }),
        {} as Record<string, number>
      )

  // Run each library in a separate Suite to prevent V8 inline cache
  // pollution between different Proxy handler objects, which causes
  // whichever library runs first to appear faster.
  const results: { name: string; hz: number; stats: any }[] = []

  const libs = [
    {
      name: 'Mutative',
      fn: (baseState: any, i: number) => {
        create(baseState, (draft) => {
          draft.key0 = i
        })
      },
    },
    {
      name: 'Immer',
      fn: (baseState: any, i: number) => {
        produce(baseState, (draft: any) => {
          draft.key0 = i
        })
      },
    },
    {
      name: 'Doura',
      fn: (baseState: any, i: number) => {
        douraProduce(baseState, (draft: any) => {
          draft.key0 = i
        })
      },
    },
  ]

  for (const lib of libs) {
    let i: number
    let baseState: Record<string, number>

    const suite = new Suite()
    suite
      .add(lib.name, () => lib.fn(baseState, i), {
        onStart: () => {
          i = Math.random()
          baseState = getData(size)
        },
      })
      .on('cycle', (event: any) => {
        console.log(String(event.target))
        results.push({
          name: event.target.name,
          hz: event.target.hz,
          stats: event.target.stats,
        })
      })
      .run({ async: false })
  }

  const fastest = results.reduce((a, b) => (a.hz > b.hz ? a : b))
  console.log(`Size ${size}: The fastest method is ${fastest.name}`)
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
