# Snapshot 核心架构

## 问题定义

Draft 系统中，state 被 Proxy 包裹为 mutable draft。用户通过 draft proxy 读写 state。snapshot 要解决的核心问题：

**将一棵包含 mutable draft proxy 的树，转换为一个不含 draft proxy 的 plain value 树，作为某一时刻的不可变快照。**

## 必须保证的条件

### 1. 时间点隔离

snapshot 是 action 完成时刻的状态冻结。后续 action 修改 draft 不能影响已有 snapshot。

```
Action 1 → snapshot1 = { user: { name: 'Bob' } }
Action 2 → 修改 user.name = 'Charlie'
snapshot1.user.name === 'Bob'   ← 不受影响
```

实现机制：`stealAndReset` 把 copy 从 draft state 中剥离。draft 重置为 clean，snapshot 持有 stolen copy。

### 2. 无 draft proxy 泄漏

snapshot 的结果中不能包含 draft proxy。任何层级的属性值都必须是 plain value。

draft proxy 泄漏的后果：
- 可变性泄漏 — draft proxy 的 set trap 仍然活跃
- 内存泄漏 — draft proxy 持有整棵 DraftState 树
- 结构共享失效 — 每次 snapshot 创建新 draft proxy，引用比较永远不等

### 3. DraftState 身份保留

draft proxy 在 stolen copy（`state.base`）中必须保留，不被替换为 plain value。这确保下次 action 访问同一属性时复用同一 DraftState，而不是创建新的。

这是 reactivity 系统的基础：View（computed）通过 `track(state, GET, key)` 建立依赖。如果 DraftState 对象变了，旧依赖丢失，View 不再响应变化。

```
stolen copy（state.base）= { user: userDraftProxy, ... }
                                    ^^^^^^^^^^^^^^^^^^^
                                    必须保留 draft proxy
                                    下次 action: this.user → get trap → 复用 userDraftProxy → 同一 DraftState
```

### 4. 结构共享

未修改的子树在连续 snapshot 之间返回相同引用（`===`），使 React 的 `useSyncExternalStore` 能跳过不必要的 re-render。

```
Action 1: 修改 user → snapshot1 = { user: newClone, settings: cachedRef }
Action 2: 修改 count → snapshot2 = { user: cachedRef, settings: cachedRef, count: newClone }
snapshot1.settings === snapshot2.settings  ← true，跳过 re-render
```

### 5. 支持任意 value

`snapshot(value, draft)` 的 `value` 不一定是 root draft。model 的 View 系统传入计算结果：

```ts
// View 返回计算值
snapshot([this.a, this.b], this.stateRef.value)
snapshot({ count: this.items.length }, this.stateRef.value)
```

snapshot 必须能解析任意值中嵌套的 draft proxy，包括 plain object 内部的 draft proxy。

## Draft proxy 出现的位置

snapshot 需要处理所有 draft proxy 可能出现的位置：

| 位置 | 产生方式 | 示例 |
|------|---------|------|
| 直接子属性 | GET trap 创建 child draft | `d.user` → `copy.user = userProxy` |
| 用户赋值的 key | SET trap 移动 draft | `d.foo = d.obj` → `copy.foo = objProxy` |
| plain object 内部 | 用户赋值包含 draft 的新对象 | `d.foo = { bar: d.obj }` |
| 跨 root 外部 draft | 另一个 draft 树的 child | `d.ref = otherRoot.obj` |
| Set 元素 | lazy draft 或 add() | `set.add(d.obj)` |

## 当前设计

### 核心数据结构

```
DraftState:
  base    — steal 后的 copy（含 draft proxy refs，不被修改）
  copy    — 当前 action 的修改（steal 后清零）
  proxy   — draft proxy 自身
  key     — creation-time key（GET trap 创建时的属性名，不可变）
  children — 子 DraftState 数组（per-state，受 removeChildRef 影响）
  assignedMap — 用户 SET/DELETE 的 key 记录（per-state）
```

### snapshot 流程

```
snapshot(value, draft, cache?):
  1. BFS 收集 modified states（通过 children 树）
  2. Leaf-first stealAndReset（剥离 copy，重置 state）
  3. buildClones — 对每个 modified state 的 stolen copy 做 shallow clone + resolve
  4. resolveValue(value) — copy-on-write 解析 value 中的 draft proxy refs
  5. 返回 plain value 结果
```

### 两层解析机制

**第一层：children（解析直接子属性的 draft proxy）**

每个 modified state 遍历其 children 数组，用 `child.key`（creation-time key）定位 parent clone 中的 draft proxy，替换为 resolved value。

```
parent clone[child.key] === child.proxy → 替换为 child clone 或 child.base
```

覆盖场景：所有通过 GET trap 创建的 child draft。

**第二层：assignedMap（解析用户赋值位置的 draft proxy）**

遍历 modified state 的 `assignedMap`，对 `assigned=true` 的 key：
- key 处是 draft proxy → 替换为其 clone/copy/base（处理 rename、multi-ref）
- key 处是 plain draftable object → `resolveValue` 递归进入（处理 nested-in-plain-object、cross-root）

覆盖场景：rename (`d.foo = d.obj; delete d.obj`)、multi-ref (`d.b = d.a`)、nested draft (`d.foo = { bar: d.obj }`)、cross-root (`d.ref = otherRoot.obj`)。

### Copy-on-write 策略

**stolen copy 不被修改。** 解析在 clone 上完成。

```
stolen copy: { user: userProxy, settings: settingsProxy }   ← 不动
clone:       { user: userClone, settings: settingsBase }     ← 新建
```

对于非 modified state 的值（如 view 返回的 plain object），`resolveValue` 采用 copy-on-write：

```
resolveValue({ count: 5, items: itemsProxy }):
  count: 5 → 不变
  items: itemsProxy → resolve → 需要替换
  → 触发 copy-on-write: { ...original, items: resolvedItems }
  如果没有 draft proxy → 返回原对象（零分配）
```

### 结构共享

`cache` 参数（model 系统传入 `_lastDraftToSnapshot`）缓存 `draftProxy → resolvedValue`：

- modified state：清除旧缓存，存入新 clone
- unmodified state：从缓存返回上一次的 resolved value（同引用）
- 无缓存时（standalone 用法）：unmodified state 返回 `state.base`（原始值，同引用）

### 复杂度

| 操作 | 复杂度 |
|------|--------|
| BFS 收集 | O(M) — M = modified states |
| stealAndReset | O(M) |
| buildClones | O(M × K) — K = 每个 state 的 children/assignedMap 平均大小 |
| resolveValue | O(V) — V = value 中需要检查的属性数。copy-on-write 使得无 draft 的子树零分配 |
| 内存 | O(M) shallow copies（clone per modified state）+ O(1) per unmodified（返回原引用） |
| Proxy 分配 | 零 |
