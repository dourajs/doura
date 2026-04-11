// @ts-nocheck
/**
 * Benchmark: batch mutation (10% of keys) on nested objects — fast path vs slow path.
 *
 * Both entries use a long-lived draft (ModelInternal pattern).
 * The only variable is whether snapshot() receives a snapshots Map (slow path)
 * or not (fast path / finalizeDraft).
 */
import { runBenchmark } from './runner'

const douraSetup = `
  const { draft, snapshot } = require('./packages/doura');
  const STATE = '__r_state';
  let lastBaseState;
  let stateRef;
  let lastDraftToSnapshot;
  let __iter = 0;
`

runBenchmark({
  getData: `(size) => Array(size).fill(1).reduce((acc, _, key) => Object.assign(acc, { ['key' + key]: { value: key } }), {})`,
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
      name: 'Doura (fast)',
      setup: douraSetup,
      fn: `
        if (baseState !== lastBaseState) {
          lastBaseState = baseState;
          stateRef = draft({ value: baseState });
        }
        for (let index = 0; index < size * 0.1; index++) {
          stateRef.value['key' + index].value = ++__iter;
        }
        const snap = snapshot(stateRef.value, stateRef.value);
        const _ = snap.key0.value;
        stateRef[STATE].modified = false;
      `,
    },
    {
      name: 'Doura (slow)',
      setup: douraSetup,
      fn: `
        if (baseState !== lastBaseState) {
          lastBaseState = baseState;
          stateRef = draft({ value: baseState });
          lastDraftToSnapshot = new Map();
        }
        for (let index = 0; index < size * 0.1; index++) {
          stateRef.value['key' + index].value = ++__iter;
        }
        const dts = new Map(lastDraftToSnapshot);
        lastDraftToSnapshot = dts;
        const snap = snapshot(stateRef.value, stateRef.value, lastDraftToSnapshot);
        const _ = snap.key0.value;
        stateRef[STATE].modified = false;
      `,
    },
  ],
})
