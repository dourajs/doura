# 调度器

源码位置：`packages/doura/src/core/scheduler.ts`

Doura 的调度器直接移植自 Vue 3，基于 microtask 的异步批处理队列。它在 doura 中承担两个职责：

1. **延迟合并**：draft 的多次 trigger 只产生一次 `_update` 调用
2. **被 action 绕过**：action depth=0 时同步刷新，确保调用者立即拿到新 state

---

## 核心状态

```ts
// scheduler.ts:28-43
let isFlushing = false        // 正在执行队列
let isFlushPending = false    // 已安排 microtask 但尚未执行

const queue: SchedulerJob[] = []              // 主队列
const pendingPreFlushCbs: SchedulerJob[] = [] // pre-flush 回调
const pendingPostFlushCbs: SchedulerJob[] = [] // post-flush 回调

const resolvedPromise = Promise.resolve()
let currentFlushPromise: Promise<void> | null = null
```

---

## queueJob — 入队

`scheduler.ts:76-98`:

```ts
function queueJob(job) {
  // 去重：同一个 job 不会重复入队
  if (!queue.includes(job, ...)) {
    if (job.id == null) {
      queue.push(job)         // 无 id → 追加到末尾
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job) // 有 id → 二分插入保持有序
    }
    queueFlush()
  }
}
```

`queueFlush()` (`scheduler.ts:100-105`): 如果还没有 pending microtask，安排一个：

```ts
function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}
```

---

## invalidateJob — 取消排队

`scheduler.ts:107-112`:

```ts
function invalidateJob(job) {
  const i = queue.indexOf(job)
  if (i >= flushIndex) {
    queue.splice(i, 1)
  }
}
```

**使用场景**：action 完成时 `invalidateJob(this._update)` 取消已排队的 microtask 版 `_update`，然后同步调用 `this._update()`。

---

## flushJobs — 执行队列

`scheduler.ts:217-276`:

```
flushJobs()
    │
    ├── flushPreFlushCbs()       ← 执行 pre-flush 回调
    │
    ├── queue.sort(by id)        ← 按 id 排序保证执行顺序
    │
    ├── for each job in queue:
    │     job()                  ← 执行任务
    │
    ├── flushPostFlushCbs()      ← 执行 post-flush 回调
    │
    └── if (queue.length || pending*Cbs.length)
          flushJobs()            ← 递归排干（有些 post-flush 可能产生新 job）
```

### 三阶段设计

| 阶段 | 队列 | 典型用途 |
|------|------|---------|
| Pre-flush | `pendingPreFlushCbs` | 在主任务前执行的准备工作 |
| Main | `queue` | Model `_update`、ModelManager 全局通知 |
| Post-flush | `pendingPostFlushCbs` | 主任务完成后的清理/副作用 |

Doura 目前主要使用 main queue（`queueJob`）。Pre/Post flush 机制保留自 Vue 3 移植，为未来扩展预留。

---

## 递归保护

`scheduler.ts:278-297`:

```ts
const RECURSION_LIMIT = 100

function checkRecursiveUpdates(seen, fn) {
  const count = seen.get(fn) || 0
  if (count > RECURSION_LIMIT) {
    warn('Maximum recursive updates exceeded...')
    return true  // 跳过此 job
  }
  seen.set(fn, count + 1)
}
```

仅在 `__DEV__` 模式下启用，防止 action/view 互相触发导致无限循环。

---

## nextTick

`scheduler.ts:50-56`:

```ts
function nextTick(fn?) {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(fn) : p
}
```

返回一个 Promise，在当前 flush 完成后 resolve。用于需要等待所有 pending 更新完成的场景。

---

## Action 同步刷新 vs 调度器延迟

```
draft 写入（非 action 内）    Action 内写入
         │                        │
    trigger()                trigger()
         │                        │
    watch callback           watch callback
         │                        │
    queueJob(_update)        queueJob(_update) ← 入队，但...
         │                        │
    ... microtask ...         action 完成 (depth=0):
         │                    invalidateJob(_update) ← 取消
    flushJobs()               _update()              ← 同步执行
         │                        │
    _update() → dispatch      dispatch → snapshot → 新 state
```

**为什么不全部同步？** 非 action 场景（如 plugin 直接修改 draft）走 microtask 合并，避免过度触发。Action 场景必须同步，因为调用者期望 action 返回后 state 已更新。
