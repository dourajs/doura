# 性能与可靠性 Code Review

> 日期：2026-04-10
> 范围：`packages/doura/src/reactivity/`、`packages/doura/src/core/`、`packages/react-doura/src/`
> 原则：不违背项目目标（model-based、reactive + immutable、decentralized），仅从性能和可靠性层面提出意见

---

## P0 — 必须修复

### 1. Draft children 数组只增不减，导致内存泄漏和 snapshot 性能退化

**位置**：`packages/doura/src/reactivity/draft.ts:134`

每次读取嵌套对象时 `parent.children.push(child)`，但没有任何代码移除 child。`disposeDraft()` 虽然定义了（`draft.ts:62`）但整个项目中没有任何调用点——它是死代码。

**后果**：

- `takeSnapshotFromDraft`（`draft.ts:170-185`）BFS 遍历整棵 children 树。随着嵌套属性被访问，children 线性增长，snapshot 耗时持续退化
- `replace()`（`model.ts:274`）替换整棵 state 后，旧 state 的 children 仍挂在 root draft 上，永远不会被 GC
- `_lastDraftToSnapshot` Map（`model.ts:201`）同样累积旧 children 的 entries，只在 `destroy()` 时清理

**场景**：一个长生命周期的 model 经历多次 `replace()` 或频繁访问深层嵌套属性，内存持续上升，snapshot 越来越慢。

**建议**：在 `replace()` 时清理旧 children 引用并重置 `_lastDraftToSnapshot`；在 `set` trap 中当属性被新 draft 替换时，从 children 移除旧 child。

---

### 2. Set 的 `has()` 实现有正确性 bug

**位置**：`packages/doura/src/reactivity/collectionHandlers.ts:125-127`

```ts
return state.type === DraftType.Set
  ? state.drafts.has(key) && state.drafts.has(state.drafts.get(key))
  : false
```

`state.drafts` 存储 `原始值 → draft值` 映射。第二个条件 `state.drafts.has(draft值)` 永远为 false（draft 值不会作为 key 出现在 drafts Map 中），导致 `set.has(原始值)` 在 copy 准备后**始终返回 false**。

**验证方式**：

```ts
const original = { id: 1 }
const s = new Set([original])
const d = draft(s)
// 触发 prepareSetCopy
d.forEach(() => {})
// 此时 d.has(original) 应为 true，实际返回 false
```

**建议**：修正条件逻辑，`state.drafts.has(key)` 即可判定原始值存在于 Set 中。

---

### 3. 生产环境 scheduler 无全局递归保护

**位置**：`packages/doura/src/core/scheduler.ts:240-242, 268-274`

```ts
// scheduler.ts:240-242
const check = __DEV__
  ? (job: SchedulerJob) => checkRecursiveUpdates(seen!, job)
  : NOOP  // <-- 生产环境不检查
```

`flushJobs` 在 queue 非空时递归调用自身（`scheduler.ts:268-274`）。`RECURSION_LIMIT` 检查仅在 `__DEV__` 模式下生效。

**后果**：生产环境中如果 job A 触发 job B、job B 触发 job A（通过 model 间 `depend` 和 subscriber 互相修改），会无限递归直到栈溢出，表现为页面白屏且无有意义的错误信息。

**建议**：在 `flushJobs` 中增加与 `__DEV__` 无关的全局迭代计数，超过阈值时 throw 并清空 queue。成本极低（一个整数比较），但能防止生产环境静默崩溃。

---

## P1 — 应当修复

### 4. React selector view 组件卸载时不销毁 ModelView

**位置**：`packages/react-doura/src/createUseModel.tsx:51-78`

`ModelView` 通过 `useMemo` 创建，前一个 view 在 `useMemo` 重新执行时销毁。但组件卸载时没有 `useEffect` cleanup（整个文件无 `useEffect` 调用），最后一个 `ModelView` 永远不会被 `destroy()`。

**后果**：`ModelView` 内部的 `ReactiveEffect` 仍挂在 model 的 `effectScope` 中，持续追踪依赖、触发重算。大量使用 selector 的组件反复挂载/卸载后，orphaned effect 堆积，model 状态变更时做越来越多无用的 view 计算。

**建议**：增加 `useEffect` cleanup 调用 `selectorRef.current?.destory()`。

---

### 5. `getApi()` 在跨 model 依赖场景下缓存失效

**位置**：`packages/doura/src/core/model.ts:303-315, 345-354`

`_api` 仅在 `_setState()`（`model.ts:486`）时置 null。但 `depend()` 转发的子 model 变更事件（`model.ts:345-354`）不经过 `_setState`，所以 parent model 的 `_api` 不被刷新。

**场景**：parent model 的 view 读取了 child model 的数据，child 变更后，通过 `depend` 通知了 parent 的 subscriber，但 parent 的 `$getApi()` 返回的仍是旧的缓存对象（view snapshot 已过期）。

**建议**：`_triggerListener` 中也执行 `this._api = null`，或将 `_api` 改为在 `getApi()` 中每次检查 views 是否有 dirty 标记。

---

### 6. `depend()` 持有已销毁子 model 的引用

**位置**：`packages/doura/src/core/model.ts:345-355, 465-483`

parent subscribe 到 child，unsubscribe 函数存在 `_depListenersHandlers`。如果 child 先于 parent 被 `destroy()`，child 的 `_subscribers.clear()` 会使 unsubscribe 函数变成空操作，但 parent 的闭包仍强引用已销毁的 child `ModelInternal`，阻止 GC。

**场景**：按路由动态创建/销毁 child model，parent model 长期存活。每次路由切换 parent 都积累一个已销毁 child 的引用。

**建议**：child `destroy()` 时主动通知 parent（或 parent subscribe 时注册 child 的 onDestroy 回调，收到时清理引用和 unsubscribe handler）。

---

### 7. Provider 更换 store 时旧 store 未 destroy

**位置**：`packages/react-doura/src/createContainer.tsx:28-44`

`useMemo` 在 `propsStore` 变化时创建新 store，但不销毁旧的内部 store。旧 store 的所有 model 实例、effect scope、subscriber 全部泄漏。

**建议**：用 `useEffect` 返回 cleanup 函数，在 store 切换时对非外部传入的旧 store 调用 `destroy()`。

---

## P2 — 值得改进

### 8. async action 的 split-flush 语义

**位置**：`packages/doura/src/core/model.ts:532-549`

`_actionDepth` 在 `await` 前的同步段 finally 中归零并同步 flush。`await` 恢复后的写入以 `_actionDepth=0` 执行，走 microtask 异步刷新路径。

**结果**：单个 async action 中，`await` 前的变更同步通知 subscriber，`await` 后的变更异步通知。中间状态对外可见，破坏了"一个 action 一次状态变更"的直觉。测试（`actions.test.ts:141-166`）已覆盖此行为，说明是有意为之。

**建议**：无需改代码，但文档中应明确说明 async action 的 flush 语义：`await` 是一个隐式的 flush 边界。

---

### 9. Snapshot Proxy 闭包持有整棵 copies Map

**位置**：`packages/doura/src/reactivity/snapshotHandler.ts:13-46`

每个 snapshot proxy 的 handler 闭包捕获了 `copies` 和 `snapshots` 两个 Map。即使消费者只保留一个叶子 proxy（如 `state.items[0].name` 的 snapshot），整棵 snapshot 树的 Map 都无法 GC。

**建议**：考虑对 snapshot 做"脱水"处理——如果消费者需要长期持有某个值，提供 `toPlain()` 或类似 API 将 snapshot proxy 转为普通对象，释放闭包引用。

---

### 10. `readonlyModel` 吞掉合法 API 方法

**位置**：`packages/react-doura/src/createUseModel.tsx:16-36`

dev-mode 的 readonly proxy 只透传 `$state`、state keys、views、actions，其余返回 `undefined`。`$name`、`$patch`、`$subscribe`、`$onAction` 等全部被静默吞掉，无任何警告。`useStaticModel` 的使用者在开发模式下调用 `model.$patch()` 会得到 `undefined is not a function`。

**建议**：将 readonly proxy 改为白名单放行 `$` 前缀的读取方法，只拦截 set 操作。或者至少在 get 返回 `undefined` 时 `console.warn`。

---

### 11. `snapshotHandler` 的 `forEach` 第三参数传了原始对象

**位置**：`packages/doura/src/reactivity/snapshotHandler.ts:110`

```ts
return callback.call(thisArg, value, isMap(target) ? key : value, target)
```

第三参数应为 snapshot proxy 本身（集合遍历约定），但传了 raw `target`。用户代码 `map.forEach((v, k, m) => m.get(...))` 拿到的是未经 snapshot 包装的原始对象，绕过了不可变保护。

**建议**：将 `target` 替换为 proxy 自身引用。
