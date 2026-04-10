// @ts-nocheck
/**
 * Benchmark: long-lived draft children accumulation
 *
 * Verifies that draft children don't leak across snapshot/replace cycles.
 * Simulates ModelInternal's usage pattern with a persistent root draft.
 */
import { draft, snapshot } from '../../packages/doura'

const STATE = '__r_state'

function markUnchanged(d: any) {
  const state = d[STATE]
  if (state) state.modified = false
}

function resetDraftChildren(d: any) {
  const root = d[STATE]
  const q = [...root.children.keys()]
  root.children = new Map()
  while (q.length) {
    const s = q.pop()
    for (const [child] of s.children) q.push(child)
    s.children = new Map()
    s.copy = null
  }
}

function getChildrenCount(d: any): number {
  const state = d[STATE]
  let count = 0
  const queue = [state]
  while (queue.length) {
    const s = queue.pop()!
    count++
    for (const [c] of s.children) queue.push(c)
  }
  return count
}

function avg(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// ===== Scenario 1: replace() with resetDraftChildren =====
function benchReplace(cycles: number) {
  const rootDraft = draft({ value: { items: [{ text: 'a' }], count: 0 } })

  const times: number[] = []
  const childCounts: number[] = []
  for (let c = 0; c < cycles; c++) {
    const _ = rootDraft.value.items[0].text

    const start = performance.now()
    snapshot(rootDraft.value, rootDraft.value)
    times.push(performance.now() - start)
    markUnchanged(rootDraft)
    childCounts.push(getChildrenCount(rootDraft))

    // Simulate model.replace()
    resetDraftChildren(rootDraft)
    rootDraft.value = { items: [{ text: `item-${c}` }], count: c }
  }

  return { times, childCounts }
}

// ===== Scenario 2: same paths, repeated mutations =====
function benchSamePaths(cycles: number) {
  const rootDraft = draft({
    value: {
      a: { nested: { deep: { value: 0 } } },
      b: { nested: { deep: { value: 0 } } },
    },
  })

  const times: number[] = []
  const childCounts: number[] = []
  for (let c = 0; c < cycles; c++) {
    rootDraft.value.a.nested.deep.value = c
    rootDraft.value.b.nested.deep.value = c

    const start = performance.now()
    snapshot(rootDraft.value, rootDraft.value)
    times.push(performance.now() - start)
    markUnchanged(rootDraft)
    childCounts.push(getChildrenCount(rootDraft))
  }

  return { times, childCounts }
}

// --- Run ---
const CYCLES = 500
const SAMPLE = 10

console.log('=== Scenario 1: replace() with children cleanup ===')
console.log(`${CYCLES} cycles, each replaces state\n`)
const r1 = benchReplace(CYCLES)
const r1Early = avg(r1.times.slice(0, SAMPLE))
const r1Late = avg(r1.times.slice(CYCLES - SAMPLE))
console.log(`  Snapshot avg (first ${SAMPLE}):  ${r1Early.toFixed(4)} ms`)
console.log(`  Snapshot avg (last ${SAMPLE}):   ${r1Late.toFixed(4)} ms`)
console.log(`  Late / Early ratio:       ${(r1Late / r1Early).toFixed(2)}x`)
console.log(
  `  Children: first=${r1.childCounts[0]}, last=${
    r1.childCounts[CYCLES - 1]
  }, max=${Math.max(...r1.childCounts)}`
)
console.log(
  `  ${
    r1.childCounts[CYCLES - 1] > r1.childCounts[0] * 3
      ? '⚠️  LEAK'
      : '✅  Stable'
  }`
)
console.log()

console.log('=== Scenario 2: same paths, repeated mutations ===')
console.log(`${CYCLES} cycles, always access same nested paths\n`)
const r2 = benchSamePaths(CYCLES)
const r2Early = avg(r2.times.slice(0, SAMPLE))
const r2Late = avg(r2.times.slice(CYCLES - SAMPLE))
console.log(`  Snapshot avg (first ${SAMPLE}):  ${r2Early.toFixed(4)} ms`)
console.log(`  Snapshot avg (last ${SAMPLE}):   ${r2Late.toFixed(4)} ms`)
console.log(`  Late / Early ratio:       ${(r2Late / r2Early).toFixed(2)}x`)
console.log(
  `  Children: first=${r2.childCounts[0]}, last=${
    r2.childCounts[CYCLES - 1]
  }, max=${Math.max(...r2.childCounts)}`
)
console.log(
  `  ${
    r2.childCounts[CYCLES - 1] > r2.childCounts[0] * 3
      ? '⚠️  LEAK'
      : '✅  Stable'
  }`
)
