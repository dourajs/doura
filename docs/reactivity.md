# 响应式系统

源码位置：`packages/doura/src/reactivity/`

Doura 的响应式系统融合了两种范式：

- **Immer 式 copy-on-write draft**：首次写入时浅拷贝，修改标记沿 parent 链冒泡
- **Vue 3 式细粒度依赖追踪**：Proxy get/set 中 track/trigger，驱动 View（computed）惰性重算

两者共存于同一套 Proxy handler 中，写入同时触发 copy-on-write 和依赖通知。

---

## 1. Draft — copy-on-write Proxy

> `draft.ts`

### DraftState 结构

```ts
// draft.ts:25-45
interface DraftStateBase<T> {
  id: number
  root: DraftState         // 根 draft state
  parent?: DraftState      // 父 draft state
  base: T                  // 原始值
  proxy: T                 // draft proxy 自身
  copy: T | null           // 首次写入后的浅拷贝
  modified: boolean        // 是否被修改
  disposed: boolean        // 是否已销毁
  listeners: (() => void)[] // 变更监听器（root 上）
  children: DraftState[]   // 子 draft 列表
}
```

### 创建流程

`draft(target, parent?)` (`draft.ts:68-142`)：

1. 检查 `targetType`（Object/Array/Map/Set），不可观察类型直接返回
2. 构造 `DraftState`，`copy: null`, `modified: false`
3. 根据类型选择 handler：Object/Array → `mutableHandlers`，Map/Set → `mutableCollectionHandlers`
4. `new Proxy(proxyTarget, handlers)` 创建 proxy
5. 建立 parent-child 关系：`parent.children.push(state)`

**为什么 Array 和 Collection 用不同的 proxyTarget？** Array 的 proxyTarget 是 `[]` 而非 state 对象，这样 `obj instanceof Array` 检查才能通过。Map/Set 同理，必须用真实的 Map/Set 实例作为 proxyTarget。

### 写入路径（copy-on-write）

发生在 `baseHandlers.ts` 的 `set` trap (`baseHandlers.ts:152-208`)：

```
this.xxx = value
    │
    ▼
set trap 读取 latest(state)（copy || base）
    │
    ├── Object.is(value, current) → 值未变，直接返回
    │
    └── 值变了:
        ├── prepareCopy(state)     ← 首次写入：shallowCopy(base) → copy
        ├── markChanged(state)     ← modified=true，沿 parent 链冒泡
        ├── state.copy[prop] = value
        ├── trigger(state, SET/ADD, prop)  ← 通知依赖
        └── triggerDraft(state)    ← 沿 parent 链标记 mightChange
```

`prepareCopy` (`baseHandlers.ts:47-51`): 惰性浅拷贝，只在首次写入时执行。

`markChanged` (`common.ts`): 将当前 state 及所有祖先标记为 `modified = true`。**为什么需要冒泡？** 因为 snapshot 时需要知道从根到叶哪些路径发生了变更，只对变更路径创建新拷贝，未变更路径共享旧引用。

### 读取路径（惰性子 draft 创建）

`baseHandlers.ts` 的 `get` trap (`baseHandlers.ts:100-148`)：

```
this.xxx  (读取嵌套对象)
    │
    ▼
get trap: value = Reflect.get(latest(state), prop)
    │
    ├── track(state, GET, prop)           ← 依赖收集
    │
    └── isObject(value) && !isDraft(value)?
        ├── yes: prepareCopy(state)
        │        state.copy[prop] = draft(value, state)  ← 惰性创建子 draft
        │        trackDraft(value)                        ← 追踪 draft 引用
        └── no:  返回原始值
```

**为什么惰性创建子 draft？** 避免对整棵状态树一次性创建所有 proxy。只有被读取的嵌套对象才会变成 draft，未触碰的部分保持原始值。

### 数组变异方法

`baseHandlers.ts:87-97`: `push/pop/shift/unshift/splice` 被拦截，执行时 `pauseTracking()` → 调用原始方法 → `resetTracking()`。

**为什么？** 这些方法内部既读又写（比如 `push` 读取 `length`），不暂停追踪会导致无限循环。

### watch — draft 变更监听

`draft.ts:144-158`: `watch(draft, cb)` 将回调注册到 **root** state 的 `listeners` 数组。当 `trigger()` 执行到末尾时（`effect.ts:375-378`），遍历 `state.root.listeners` 调用所有回调。

这是 Model 层监听 draft 变更的入口：`ModelInternal` 构造时 `watch(this.stateRef, () => queueJob(this._update))`。

---

## 2. Snapshot — 结构共享的不可变视图

> `draft.ts:160-211`, `snapshotHandler.ts`

### 生成流程

`snapshot(value, draft, snapshots?)` (`draft.ts:200-211`)：

1. `takeSnapshotFromDraft(draft, snapshots)` — BFS 遍历整棵 draft 树：
   - `modified` 的 state → `shallowCopy(copy)` 得到新对象，重置 `modified=false`，更新 `base`
   - 未修改的 state → `createSnapshotProxy(base, draftSnapshot)` 复用旧值
2. `createSnapshotProxy(value, draftSnapshot)` — 创建只读 Proxy

### Snapshot Proxy（snapshotHandler）

`snapshotHandler.ts` 中的 `get` trap：

- 访问属性时，检查值是否是 draft（通过 `copies` Map 查找对应 state）
- 如果是 draft，返回 copies 中已生成的 snapshot 值
- 如果不是 draft 但 `snapshots` Map 中有缓存，直接返回缓存
- 否则递归创建 snapshot proxy

**为什么用 `snapshots` Map 做缓存？** 实现结构共享。未修改子树的 snapshot proxy 在多次 snapshot 调用间被复用（`_lastDraftToSnapshot` in `model.ts:201`），避免每次 action 后重建整棵 snapshot 树。

---

## 3. Effect / 依赖追踪

> `effect.ts`

### 数据结构

```ts
// effect.ts:21
const targetMap = new WeakMap<any, KeyToDepMap>()  // target → key → Dep
// Dep 是 Set<ReactiveEffect>，附加 w（wasTracked）和 n（newlyTracked）位标记
```

### ReactiveEffect

`effect.ts:64-152`: 核心调度单元。

- `fn`: 被追踪的函数
- `scheduler`: 依赖变更时的调度回调（不直接 re-run fn，而是调度）
- `deps`: 该 effect 订阅的所有 Dep 集合
- `run()`: 执行 fn，期间设置 `activeEffect = this`，所有 `track()` 调用都会关联到当前 effect

### track / trigger

**track** (`effect.ts:220-233`)：

```ts
function track(target, type, key) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target)    // 找到 target 的 dep 映射
    let dep = depsMap.get(key)             // 找到 key 的 dep 集合
    trackEffects(dep)                       // 将 activeEffect 加入 dep
  }
}
```

**trigger** (`effect.ts:303-378`)：

1. 从 `targetMap` 找到 target 的所有 dep
2. 根据操作类型（SET/ADD/DELETE/CLEAR）收集相关 deps
3. `triggerEffects(deps)` — 先触发 view effect（computed），再触发普通 effect
4. 最后触发 `state.root.listeners`（draft watch 回调）

**为什么 view effect 先触发？** (`effect.ts:384-393`) 确保 computed 值在普通 effect 读取之前已标记为 dirty，避免读到过期的缓存值。

### 位运算 dep marker

`effect.ts:27, 114-128`: `trackOpBit = 1 << ++effectTrackDepth`

每层嵌套 effect 占用一个 bit。`initDepMarkers()` 标记所有旧 dep 为 `wasTracked`，`finalizeDepMarkers()` 比较新旧标记，移除不再需要的依赖。比全量 cleanup 更高效。

**递归深度超过 30 层时**（`maxMarkerBits`，SMI 限制），回退到全量 cleanup 模式。

### triggerDraft

`effect.ts:295-301`: 沿 draft parent 链向上遍历，对每层 state 查找 `referenceMap` 中的 dep，将关联的 view effect 的 `mightChange` 设为 `true`。

**为什么需要？** View 的 `getSnapshot()` 需要知道是否需要重新生成 snapshot。如果 view 计算结果本身没变，但 draft 树结构变了（子节点被修改），snapshot 仍需要更新。`mightChange` 标记正是处理这种情况。

---

## 4. View — 惰性计算值

> `view.ts`

`ViewImpl` 类似 Vue 3 的 `computed()`：

```ts
// view.ts:22-62
class ViewImpl<T> {
  dirty = true           // 是否需要重算
  mightChange = false    // draft 结构是否可能变化
  _value: T              // 缓存值
  _cacheable: boolean    // 是否启用缓存

  constructor(getter, { disableCache }) {
    this.effect = new ReactiveEffect(getter, () => {
      if (!this.dirty) {
        this.dirty = true
        triggerView(this)     // 通知依赖此 view 的其他 effect
      }
    })
    this.effect.view = this   // 反向引用，让 triggerDraft 能设置 mightChange
  }

  get value() {
    trackView(self)           // 收集依赖
    if (self.dirty || !self._cacheable) {
      self.dirty = false
      self._value = self.effect.run()!  // 重新计算
    }
    return self._value
  }
}
```

**调度策略**：依赖变更时不直接 re-run getter，而是通过 `scheduler` 设置 `dirty = true` + `triggerView()`。只有下次读取 `.value` 时才真正重算。这保证了多个依赖连续变更只计算一次。

### View 在 Model 中的使用

`model.ts:357-406` 的 `createView(viewFn)`:

1. 在 `effectScope` 内创建 `ViewImpl`
2. 挂载 `getSnapshot()` 方法：读取 `view.value`，如果 `mightChange` 或值变了，调用 `snapshot()` 生成不可变结果
3. `mightChange` 确保即使 view 计算结果引用相同，如果底层 draft 结构变了，snapshot 也会刷新
