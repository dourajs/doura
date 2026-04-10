// @ts-nocheck
/**
 * Benchmark runner that executes each library in a separate Node.js process
 * to prevent V8 Proxy inline-cache pollution between libraries.
 *
 * When multiple Proxy-based libraries run in the same process, Proxy handler
 * IC specialization for one library degrades others. Running each library in
 * its own process ensures each gets a fresh V8 with monomorphic IC.
 */
import { execSync } from 'child_process'
import * as path from 'path'

export type LibBenchmark = {
  name: string
  setup: string // top-level setup code (imports, helpers)
  fn: string // the benchmark function body
}

export type BenchmarkConfig = {
  libs: LibBenchmark[]
  getData: string // getData function body as string
  sizes: number[]
}

type Result = {
  name: string
  hz: number
  rme: number
  samples: number
}

const rootDir = path.resolve(__dirname, '../..')

function runSingleLib(
  lib: LibBenchmark,
  getData: string,
  size: number
): Result {
  const script = `
const { Suite } = require('benchmark');
${lib.setup}
const getData = ${getData};
const size = ${size};
let i = Math.random();
let baseState = getData(size);
new Suite()
  .add('${lib.name}', () => {
    ${lib.fn}
  }, {
    onStart: () => { i = Math.random(); baseState = getData(size); }
  })
  .on('complete', function() {
    const b = this[0];
    console.log(JSON.stringify({ name: b.name, hz: b.hz, rme: b.stats.rme, samples: b.stats.sample.length }));
  })
  .run({ async: false });
`
  // Use stdin with --input-type=commonjs so the script runs in a clean
  // Node.js process with cwd-based require() resolution, no temp files.
  const output = execSync('node --input-type=commonjs -', {
    input: script,
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf-8',
    timeout: 120000,
  }).trim()
  const lines = output.split('\n')
  return JSON.parse(lines[lines.length - 1])
}

function formatResult(r: Result): string {
  const hz =
    r.hz < 100
      ? r.hz.toFixed(2)
      : r.hz.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return `${r.name} x ${hz} ops/sec \xb1${r.rme.toFixed(2)}% (${
    r.samples
  } runs sampled)`
}

export function runBenchmark(config: BenchmarkConfig) {
  for (const size of config.sizes) {
    const results: Result[] = []
    for (const lib of config.libs) {
      const result = runSingleLib(lib, config.getData, size)
      console.log(formatResult(result))
      results.push(result)
    }
    const fastest = results.reduce((a, b) => (a.hz > b.hz ? a : b))
    console.log(`Size ${size}: The fastest method is ${fastest.name}`)
    console.log()
  }
}
