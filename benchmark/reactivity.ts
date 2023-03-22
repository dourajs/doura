import fs from 'fs'
// @ts-ignore
import { Suite } from 'benchmark'
// @ts-ignore
import { parse } from 'json2csv'
import { draft, snapshot } from '../packages/doura'
import { create } from 'mutative'
import produce from 'immer'

const result = [
  {
    Name: 'Naive handcrafted reducer',
  },
  {
    Name: 'Mutative',
  },
  {
    Name: 'Immer',
  },
  {
    Name: 'Doura',
  },
]

const douraProduce = (value: any, cb: (v: any) => void) => {
  const obj = draft(value as any)
  cb(obj)

  return snapshot(obj, obj)
}

const getData = () => {
  const baseState: { arr: any[]; map: Record<string, any> } = {
    arr: [],
    map: {},
  }

  const createTestObject = () =>
    Array(10 * 5)
      .fill(1)
      .reduce((i, _, k) => Object.assign(i, { [k]: k }), {})

  baseState.arr = Array(10 ** 4 * 5)
    .fill('')
    .map(() => createTestObject())

  Array(10 ** 3)
    .fill(1)
    .forEach((_, i) => {
      baseState.map[i] = { i }
    })
  return baseState
}

let baseState: any
let i: any

const suite = new Suite()

suite
  .add(
    'Naive handcrafted reducer',
    function () {
      void {
        ...baseState,
        arr: [...baseState.arr, i],
        map: { ...baseState.map, [i]: { i } },
      }
    },
    {
      onStart: () => {
        i = Math.random()
        baseState = getData()
      },
    }
  )
  .add(
    'Mutative',
    function () {
      void create(baseState, (draft) => {
        draft.arr.push(i)
        draft.map[i] = i
      })
    },
    {
      onStart: () => {
        i = Math.random()
        baseState = getData()
      },
    }
  )
  .add(
    'Immer',
    function () {
      void produce(baseState, (draft: any) => {
        draft.arr.push(i)
        draft.map[i] = i
      })
    },
    {
      onStart: () => {
        i = Math.random()
        baseState = getData()
      },
    }
  )
  .add(
    'Doura',
    function () {
      void douraProduce(baseState, (draft: any) => {
        draft.arr.push(i)
        draft.map[i] = i
      })
    },
    {
      onStart: () => {
        i = Math.random()
        baseState = getData()
      },
    }
  )
  .on('cycle', function (event: any) {
    console.log(String(event.target))
    const [name] = event.target.name.split(' - ')
    const index = result.findIndex((i) => i.Name === name)
    // @ts-ignore
    result[index][event.target.name] = Math.round(event.target.hz)
  })
  .on('complete', function (this: any) {
    console.log('The fastest method is ' + this.filter('fastest').map('name'))
  })
  .run({ async: false })

try {
  // Mutative vs Immer Performance
  // Measure(ops/sec) to update 50K arrays and 1K objects, bigger the better.
  const fields: string[] = []
  result.forEach((item) => {
    fields.push(...Object.keys(item).slice(1))
  })
  result.forEach((item) => {
    fields.forEach((field) => {
      if (!(field in item)) {
        ;(item as any)[field] = '-'
      }
    })
  })
  const csv = parse(result, {
    fields: ['Name', ...fields.reverse()],
  })
  fs.writeFileSync('benchmark.csv', csv)
} catch (err) {
  console.error(err)
}
