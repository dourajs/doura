# Object Benchmark Optimization Log

Baseline (独立进程): Doura 9.7K ops/sec (size 1000), 419 ops/sec (size 10000)
Target: 接近 Mutative (~18.4K / ~788)

---

## 前置工作：Benchmark 可靠性修复

**Commit:** 1e3edad

### 问题

原始 benchmark 将 Mutative、Immer、Doura 放在同一个 Benchmark.js Suite 中运行。由于三个库都使用 Proxy，V8 的 Proxy trap inline cache (IC) 在切换不同库的 handler 对象时会从 monomorphic 退化为 megamorphic，导致后跑的库性能虚低。

交叉验证数据（object benchmark, size 1000）：

| 顺序 | Mutative | Doura | Immer |
|---|---|---|---|
| M→I→D | **18,676** | 4,829 | 3,569 |
| D→I→M | 4,743 | **9,848** | 3,534 |
| D→M→I | **19,208** | **9,944** | 3,526 |
| I→M→D | 4,809 | 4,816 | 3,509 |
| 单跑 M | **18,890** | - | - |
| 单跑 D | - | **9,745** | - |

关键发现：Immer 的 Proxy 模式（Proxy.revocable + 不同 handler 结构）会污染 V8 IC，使后续所有库退化到 ~4.8K；Mutative 和 Doura 的 handler 结构兼容，互不干扰（D→M→I 中两者都保持高性能）。

### 修复

将 `benchmark/suite/runner.ts` 改为通过 `child_process.execSync` + `node --input-type=commonjs` stdin 为每个库启动独立 Node.js 进程。每个进程只加载一个库，V8 从零开始优化，完全消除 IC 交叉污染。

---

## Optimization 1: 移除 quickCopyObj 中的 Object.getOwnPropertyNames

**Commit:** 391dfb8

### 改动前

```ts
// utils.ts - quickCopyObj
function quickCopyObj(base: any) {
  const enumKeys = Object.keys(base)
  const copy: Record<string | symbol, any> = {}
  for (let i = 0; i < enumKeys.length; i++) {
    copy[enumKeys[i]] = base[enumKeys[i]]
  }
  // Handle non-enumerable string properties (rare but must be preserved)
  const allNames = Object.getOwnPropertyNames(base)
  if (allNames.length !== enumKeys.length) {
    for (let i = 0; i < allNames.length; i++) {
      const key = allNames[i]
      if (!isEnumerable.call(base, key)) {
        Object.defineProperty(copy, key, {
          configurable: true,
          writable: true,
          enumerable: false,
          value: base[key],
        })
      }
    }
  }
  // Handle symbol properties (rare)
  const symbols = Object.getOwnPropertySymbols(base)
  if (symbols.length > 0) {
    for (let i = 0; i < symbols.length; i++) {
      const key: any = symbols[i]
      if (isEnumerable.call(base, key)) {
        copy[key] = base[key]
      } else {
        Object.defineProperty(copy, key, { ... })
      }
    }
  }
  return copy
}

// utils.ts - shallowCopy
export function shallowCopy(base: any) {
  if (Array.isArray(base)) return slice.call(base)
  if (isMap(base)) return new Map(base)
  if (isSet(base)) return new Set(base)
  const proto = Object.getPrototypeOf(base)
  if (proto === Object.prototype || proto === null) {
    return quickCopyObj(base)
  }
  return strictCopy(base)
}
```

### 改动后

```ts
// utils.ts - quickCopyObj
function quickCopyObj(base: any) {
  const enumKeys = Object.keys(base)
  const copy: Record<string | symbol, any> = {}
  for (let i = 0; i < enumKeys.length; i++) {
    copy[enumKeys[i]] = base[enumKeys[i]]
  }
  const symbols = Object.getOwnPropertySymbols(base)
  for (let i = 0; i < symbols.length; i++) {
    const key: any = symbols[i]
    if (isEnumerable.call(base, key)) {
      copy[key] = base[key]
    }
  }
  return copy
}

const STRICT_FLAG = '__r_strict'

// utils.ts - shallowCopy
export function shallowCopy(base: any) {
  if (Array.isArray(base)) return slice.call(base)
  if (isMap(base)) return new Map(base)
  if (isSet(base)) return new Set(base)
  if (base[STRICT_FLAG]) return strictCopy(base)  // markStrict opt-in
  const proto = Object.getPrototypeOf(base)
  if (proto === Object.prototype || proto === null) {
    return quickCopyObj(base)
  }
  return strictCopy(base)
}
```

```ts
// common.ts - 新增 markStrict
export const enum ReactiveFlags {
  SKIP = '__r_skip',
  STRICT = '__r_strict',  // 新增
  // ...
}

export function markStrict<T extends object>(value: T): T {
  def(value, ReactiveFlags.STRICT, true)
  return value
}
```

### 为什么改

`Object.getOwnPropertyNames` 对大对象（1000+ keys）比 `Object.keys` 慢约 3.3 倍：

```
Object.keys (1000 keys, 100K 次):          1.4s
Object.getOwnPropertyNames (同上):          4.6s
Object.getOwnPropertySymbols (同上):        0.25s
```

在 object benchmark 中，每次 `draft.key0 = i` 触发 `prepareCopy → shallowCopy → quickCopyObj`。对 1000-key 对象，`getOwnPropertyNames` 额外增加 ~32µs/次，而整个操作目标耗时是 ~53µs（Mutative 的水平）。这一个调用占了总耗时的 60%。

Mutative 的 `shallowCopy` 对 plain objects 只做 `Object.keys` + `Object.getOwnPropertySymbols`，不调用 `getOwnPropertyNames`，不保留非枚举属性。

### 为什么行得通且不破坏逻辑

**影响范围精确受控**：

| 对象类型 | 改动前 | 改动后 | 变化 |
|---|---|---|---|
| plain object 枚举属性 | 保留 | 保留 | 无变化 |
| plain object 枚举 Symbol | 保留 | 保留 | 无变化 |
| plain object 非枚举属性 | 保留 | **不保留** | ⚠️ 行为变更 |
| plain object 非枚举 Symbol | 保留 | **不保留** | ⚠️ 行为变更 |
| class instance（所有属性） | strictCopy 保留 | strictCopy 保留 | 无变化 |
| markStrict plain object | N/A | strictCopy 保留 | 新增 opt-in |

**不破坏逻辑的理由**：

1. **plain object 极少有非枚举属性**：通过对象字面量 `{}`、`Object.assign`、JSON.parse 创建的对象全部是枚举属性。只有显式调用 `Object.defineProperty(..., { enumerable: false })` 才会产生非枚举属性，这在状态管理场景中极为罕见。

2. **class instance 不受影响**：class instance 的 `Object.getPrototypeOf(x) !== Object.prototype`，走 `strictCopy` 路径，保留所有属性描述符。这条路径完全未改动。

3. **提供了 opt-in 逃生口**：`markStrict(obj)` 让确实需要保留非枚举属性的 plain object 通过设置 `__r_strict` flag 走 `strictCopy`，功能上完全等价于改动前的行为。这对标 Mutative 的 `mark: () => 'immutable'` 模式。

4. **与 Mutative 行为一致**：Mutative 默认同样不保留 plain object 非枚举属性，且 Mutative 对 class instance 默认直接报错（需 mark opt-in），Doura 比 Mutative 更宽容（class instance 默认支持）。

**Results:** 9.7K → 18.0K ops/sec (size 1000), 419 → 776 ops/sec (size 10000)，与 Mutative 持平。
