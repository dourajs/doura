// @ts-nocheck
import { runBenchmark } from './runner'

runBenchmark({
  getData: `(size) => Array(size).fill(1).map((_, key) => ({ value: key }))`,
  sizes: [
    ...Array(1)
      .fill(1)
      .map((_, i) => (1 + i * 4) * 10 ** 3),
    ...Array(1)
      .fill(1)
      .map((_, i) => (1 + i * 4) * 10 ** 4),
  ].sort((a, b) => a - b),
  libs: [
    {
      name: 'Mutative',
      setup: `const { create } = require('mutative');`,
      fn: `create(baseState, (draft) => {
        for (let index = 0; index < size * 0.1; index++) {
          draft[index].value = i;
        }
      });`,
    },
    {
      name: 'Immer',
      setup: `const { produce } = require('immer');`,
      fn: `produce(baseState, (draft) => {
        for (let index = 0; index < size * 0.1; index++) {
          draft[index].value = i;
        }
      });`,
    },
    {
      name: 'Doura',
      setup: `
        const { draft, snapshot } = require('./packages/doura');
        const douraProduce = (value, cb) => {
          const obj = draft(value);
          cb(obj);
          return snapshot(obj, obj);
        };
      `,
      fn: `douraProduce(baseState, (draft) => {
        for (let index = 0; index < size * 0.1; index++) {
          draft[index].value = i;
        }
      });`,
    },
  ],
})
