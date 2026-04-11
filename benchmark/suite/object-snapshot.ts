// @ts-nocheck
/**
 * Benchmark: single property mutation on flat object — slow path (snapshot Proxy).
 *
 * Mirrors object.ts but uses the ModelInternal pattern:
 * long-lived draft + snapshot with snapshots Map + property read.
 */
import { runBenchmark } from './runner'

runBenchmark({
  getData: `(size) => Array(size).fill(1).reduce((acc, _, key) => Object.assign(acc, { ['key' + key]: key }), {})`,
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
      fn: `const snap = create(baseState, (draft) => { draft.key0 = i }); const _ = snap.key0;`,
    },
    {
      name: 'Immer',
      setup: `const { produce } = require('immer');`,
      fn: `const snap = produce(baseState, (draft) => { draft.key0 = i }); const _ = snap.key0;`,
    },
    {
      name: 'Doura',
      setup: `
        const { draft, snapshot } = require('./packages/doura');
        const STATE = '__r_state';
        let lastBaseState;
        let stateRef;
        let lastDraftToSnapshot;
        let __iter = 0;
      `,
      fn: `
        if (baseState !== lastBaseState) {
          lastBaseState = baseState;
          stateRef = draft({ value: baseState });
          lastDraftToSnapshot = new Map();
        }
        stateRef.value.key0 = ++__iter;
        const dts = new Map(lastDraftToSnapshot);
        lastDraftToSnapshot = dts;
        const snap = snapshot(stateRef.value, stateRef.value, lastDraftToSnapshot);
        const _ = snap.key0;
        stateRef[STATE].modified = false;
      `,
    },
  ],
})
