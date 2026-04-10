# Array Benchmark Optimization Log

Baseline: Doura 312K ops/sec (size 1000), 77K ops/sec (size 10000)
Target: Approach or exceed Mutative (~960K / ~400K)

---

## Optimization 1: Eliminate per-call closure allocations in snapshotHandler

**Commit:** 920045c

**What changed:**
`snapshotHandler()` 每次调用都会创建 ~7 个闭包/对象（`toSnapshot`、`getHandlers`、`objectTraps`、`collectionTraps`、`collectionInstrumentations` 及其方法）。即使目标是 array/object 类型，不需要 collection 相关代码，这些对象也全部被创建。

重构为：
- `objectTraps` 和 `collectionTraps` 改为模块级单例 handler
- `toSnapshot` 改为普通函数，接收 `DraftSnapshot` 参数
- 使用模块级 `WeakMap<object, DraftSnapshot>` (snapshotCtxMap) 存储 proxy target 到 DraftSnapshot 的映射，避免闭包捕获
- `collectionInstrumentations` 在模块加载时一次性创建

**为什么行得通：**
原来的闭包唯一的作用是捕获 `copies` 和 `snapshots` 两个 Map 引用。通过 WeakMap 查找替代闭包捕获，proxy handler 对象可以被所有调用共享。WeakMap 查找是 O(1) 且不会阻止 GC。

**为什么不会破坏逻辑：**
`snapshotHandler` 的语义完全不变——给定 target 和 DraftSnapshot，返回对应的 proxy handler。只是从"每次创建新 handler 对象"变成"返回共享的单例 handler + 在 WeakMap 中注册 context"。所有 trap 行为（get 拦截、toSnapshot 解析、collection 方法代理）完全一致。

**Results:** 312K → 340K ops/sec (size 1000), +9%

---

## Optimization 2: Eager finalization — 消除 standalone snapshot 的 Proxy 开销

**Commit:** 62aaa16

**What changed:**
当 `snapshot(value, draft)` 在没有外部 `snapshots` 缓存的情况下调用（即独立的 `draft()/snapshot()` 模式，非 model 系统），使用 eager finalization 替代 snapshot Proxy 包装：

1. BFS 收集所有 modified states，然后从叶到根反向处理
2. 偷取 copy 并就地替换 copy 中的 draft proxy 引用为已解析的 base 值
3. 直接返回 plain 对象——不创建 Map、DraftSnapshot、Proxy

具体实现：
- 在 `DraftState` 上添加 `key` 字段，记录 child draft 在 parent copy 中的属性名
- `resolveDraftRefs()` 用 `child.key` 做 O(1) 定位替换；如果 child 被移动/删除（key 不匹配），降级为全量扫描
- `finalizeDraft()` 执行完整的 steal-and-resolve 流程
- `snapshot()` 中检测 standalone 模式并走 fast path

同时将 `draft.test.ts` 中的共享引用测试更新为与 Immer/Mutative 一致的行为：未修改子树返回原始对象引用（结构共享）。

**为什么行得通：**
Mutative 的 finalization 本质上做的就是同样的事——通过回调将 proxy 替换为 plain 值然后直接返回 copy。Doura 之前额外包了一层 snapshot Proxy 来提供不可变性和惰性解析，但对于独立使用场景（一次性 produce 模式），这层 Proxy 是纯开销：
- 每次调用分配 2 个 Map（copies、snapshots）+ 1 个 DraftSnapshot 对象 + 1 个 Proxy
- V8 profiling 显示 52.4% 的时间花在 GC 上，说明大量短命对象是瓶颈

消除这些分配直接减少了 GC 压力。

**为什么不会破坏逻辑：**
- Fast path 只在 `!snapshots && isDraft(value) && value === draft` 时激活，即只有独立使用模式
- Model 系统（传入 `snapshots` map）仍走原来的 snapshot Proxy 路径，结构共享行为不变
- `resolveDraftRefs` 的 key-based + fallback-scan 策略覆盖了所有边界情况（child 移动、删除、多重引用）
- 所有 332 个测试通过

**Results:** 340K → 1,154K ops/sec (size 1000, +240%), 77K → 474K ops/sec (size 10000, +515%)
**Final:** Doura 比 Mutative 快 ~20% (size 1000) / ~15% (size 10000)
