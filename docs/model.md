# Model 系统

源码位置：`packages/doura/src/core/`

Model 是 doura 的核心抽象单元。一个 model 定义了 state + actions + views，由 `ModelInternal` 实例化并管理运行时生命周期。

---

## 1. defineModel — 类型收窄

> `core/defineModel.ts`

`defineModel({ name, state, models?, actions?, views?, queries? })` 是一个 **identity function**，零运行时开销。它的唯一作用是为 TypeScript 提供类型推断：action 中 `this` 的类型、view 的返回类型、组合 model 的实例类型、`useModel` 的结果类型。

Model 只支持对象形式：

- **ObjectModel**: `defineModel({ name, state, models, actions, views })`
- `models: [childModel]` 使用子 model 的 `name` 作为 key，暴露为 `this.childName`、`instance.childName` 和 `instance.$models.childName`

---

## 2. ModelInternal — 运行时实例

> `core/model.ts:161-607`

### 构造流程

```ts
// model.ts:203-244（简化）
constructor(model, { name, initState }) {
  // 1. 创建 draft — state 被包装在 { value: initState } 中
  this.stateRef = draft({ value: initState || model.state })

  // 2. 监听 draft 变更 → 调度 _update
  watch(this.stateRef, () => {
    if (this._watchStateChange) queueJob(this._update)
  })

  // 3. 创建两层 Proxy
  this.proxy = new Proxy(ctx, InternalInstanceProxyHandlers)   // action/view 的 this
  this.publicInst = new Proxy(ctx, PublicInstanceProxyHandlers) // 外部 API

  // 4. 初始化 models、actions、views 和 queries
  this._initModels()
  this._initActions()
  this._initViews()
  this._initQueries()
}
```

**为什么 state 包在 `{ value: ... }` 里？** 因为 `draft()` 需要一个对象作为 proxy target。顶层 state 本身可能被 `$state = newState` 整体替换，外层容器 `stateRef` 确保 proxy 引用稳定。

### Action 执行

`model.ts:508-557` 的 `_initActions()`：

```
action 调用
    │
    ├── _actionDepth++
    ├── 通知 _actionListeners（$onAction 回调）
    ├── action.call(this.proxy, ...args)    ← this 绑定到 internal proxy
    │     │
    │     └── 写入 this.xxx → draft set trap → trigger → ...
    │
    └── finally:
          _actionDepth--
          if (depth === 0) {
            invalidateJob(this._update)    ← 取消排队的微任务
            this._update()                  ← 同步刷新
          }
```

**为什么 depth=0 时同步刷新？** 如果依赖 microtask 延迟刷新，调用者在 action 返回后立即读取 state 会拿到旧值。同步 `invalidateJob` + `_update` 保证 action 完成后 snapshot 立即可用。这也防止了 [valtio#270](https://github.com/pmndrs/valtio/issues/270) 类似的问题（注释见 `model.ts:544`）。

**为什么用 depth 计数？** 嵌套 action（action A 调用 action B）只在最外层完成时刷新一次，避免中间状态产生不必要的 snapshot。

### _update — 状态转换

`model.ts:491-500`：

```ts
_update() {
  if (this._destroyed || !isModified(this.stateRef)) return
  this.dispatch({ type: ActionType.MODIFY })
  markUnchanged(this.stateRef)           // 重置 modified 标记
}
```

### dispatch — 状态分发

`model.ts:427-463`：

1. `this.reducer(currentState, action)` — 根据 action type 生成新 state
2. 引用比较 `nextState !== currentState`
3. 更新 `_currentState`，清空 `_api` 缓存
4. 触发 `_subscribers`

### reducer

`model.ts:408-425`：

| Action Type | 行为 |
|-------------|------|
| `MODIFY` | `snapshot(stateRef.value, stateRef.value, lastDraftToSnapshot)` — 从 draft 生成不可变 snapshot |
| `PATCH` | 同 MODIFY（patch 已在 `patch()` 方法中直接修改了 draft） |
| `REPLACE` | 直接返回 `action.payload`（新的 plain object） |

`lastDraftToSnapshot` (`model.ts:201`) 是 snapshot 缓存 Map，实现跨 dispatch 的结构共享。

---

## 3. 两层 Proxy 设计

> `core/modelPublicInstance.ts`

### 为什么需要两层？

- **Internal Proxy** (`InternalInstanceProxyHandlers`, `model.ts:232-235`): action/view 内部的 `this`。读取 `stateValue`（可变 draft），允许直接修改。
- **Public Proxy** (`PublicInstanceProxyHandlers`, `model.ts:236-239`): 外部消费者的 API。读取 `getState()`（不可变 snapshot），不可直接修改。

两者共用同一个 `set` handler，但 `get` handler 的数据源不同（`modelPublicInstance.ts:62-113`）：

```ts
const createGetter = (isPublicInstance: boolean) =>
  ({ _: instance }, key) => {
    // public 读 getState()（snapshot），internal 读 stateValue（draft）
    let state = isPublicInstance ? instance.getState() : instance.stateValue

    // 按优先级查找：accessCache → state → queries → models → ctx → $ 属性
    ...
  }
```

### accessCache

`modelPublicInstance.ts:76-94`: 首次访问某个 key 时确定它是 STATE/VIEW/ACTION/QUERY/MODEL/CONTEXT 哪种类型，缓存到 `accessCache`。后续访问直接 switch 跳转，避免重复的 `hasOwn` 检查。

### $ 前缀属性

`modelPublicInstance.ts:42-59` 的 `publicPropertiesMap` 路由了所有 `$` 开头的属性：

```ts
$name    → instance.name
$rawState → instance.getState()    // snapshot
$state   → instance.stateValue     // draft（供 action 内部使用）
$actions → instance.actions
$views   → instance.views
$queries → instance.queries
$models  → instance.models
$patch   → instance.patch
$onAction → instance.onAction
$subscribe → instance.subscribe
$isolate  → instance.isolate
$getApi   → instance.getApi
$createView → createView.bind(null, instance)
$invalidateQueries → () => instance.invalidateQueries()   // 标记所有 query 缓存过期
$cancelQueries     → () => instance.cancelQueries()       // 取消所有 inflight fetch
$resetQueries      → () => instance.resetQueries()        // 清除所有 query 缓存
```

### set handler

`modelPublicInstance.ts:115-180`：

- `state` 属性 → 写入 draft（VIEW context 中禁止写入）
- `actions/views/queries/models` → 只读，拒绝修改
- `$state` → 触发 `instance.replace(value)` 整体替换
- 其他 `$` 属性 → 只读
- 其余 → 写入 `ctx`

---

## 4. Model 组合 — models

> `core/modelManager.ts`, `core/model.ts`

### 原理

ObjectModel 允许通过 `models: [otherModel]` 组合其他 model。子 model 使用自己的 `name` 作为父实例上的 key：

```ts
const childModel = defineModel({
  name: 'child',
  state: { count: 0 },
  actions: {
    inc() {
      this.count++
    },
  },
})

const parentModel = defineModel({
  name: 'parent',
  state: { value: 0 },
  models: [childModel],
  actions: {
    doSomething() {
      this.child.inc()
    },
  },
  views: {
    childCount() {
      return this.child.count
    },
  },
})
```

### 实现机制

1. `ModelManager._initModel()` 读取 `model.models`，通过 `getModelInstance({ model: child })` 获取或创建共享子实例。
2. 父实例创建时拿到两份子模型映射：
   - `models`：public instance，用于 `instance.child` 和 `$models.child`
   - `modelProxies`：internal proxy，用于 action/view 内部的 `this.child`，保证跨模型 view 读取仍能参与响应式追踪
3. 父实例创建后，对每个 child 调用 `parentInstance.depend(child)`。
4. `model.depend(dep)` subscribe 到 child 的变更事件，转发给 parent 的 subscribers。

```ts
depend(dep: ModelInternal) {
  this._depListenersHandlers.push(
    dep.subscribe((event) => {
      this._triggerListener({ ...event, model: this.proxy })
    })
  )
}
```

---

## 5. ModelManager — 实例仓库

> `core/modelManager.ts:84-232`

ModelManager 是 model 实例的注册中心：

- `getModel(model)` — 按 model 的 `name` 缓存。相同 name 返回同一个实例
- `getDetachedModel(model)` — 匿名实例，不缓存
- `subscribe(fn)` — 任何 model 变更时触发（通过 `queueJob` 合并）

### Plugin 生命周期

`modelManager.ts:102-103, 202-212`:

```
constructor:  hooks.onInit({ initialState }, { doura })
_initModel:   hooks.onModel(name, model, { doura })
              hooks.onModelInstance(publicInst, { doura })
destroy:      hooks.onDestroy()
```

Plugin 通过 `onModelInstance` 拿到 `ModelInstance`，可以调用 `$subscribe`、`$onAction` 等 API 扩展行为。

---

## 6. Query 系统

> `core/model.ts`（_initQueries, _buildQueryHandle）、`core/queryCoordinator.ts`、`core/queryTypes.ts`

Query 系统为 model 提供声明式的异步数据获取能力，支持缓存、去重、过期控制和垃圾回收。

### defineModel queries 选项

```ts
const userModel = defineModel({
  name: 'user',
  state: { users: {} as Record<string, User> },
  queries: {
    // Shorthand: 直接写函数
    fetchUser: async function (ctx, id: string) {
      const user = await api.getUser(id)
      this.users[id] = user
      return user
    },

    // Full spec: 使用 query() helper
    fetchList: query({
      fn: async function (ctx, page: number) {
        return await api.getUserList(page)
      },
      staleTime: 30_000,  // 30s 内视为新鲜
    }),
  },
})
```

**两种声明方式**：
- **Shorthand**（直接函数）：`(ctx: QueryCtx, ...args) => Promise<TData>`
- **QuerySpec**（对象）：`{ fn, staleTime? }`

`query()` helper 是一个 identity function，唯一作用是为每个 query entry 建立独立的 TypeScript 推断上下文，使 `TArgs` 和 `TData` 从 `fn` 的签名精确推断。

**fn 签名**：`fn(this: ModelThis, ctx: QueryCtx, ...args: TArgs): Promise<TData>`
- `this` 绑定到 model 的 internal proxy，可以在 query fn 内部访问/修改 state
- `ctx.signal` 是 `AbortSignal`，fetch 被取消时会 abort

### QueryHandle — 公共查询句柄

每个 query 在 model 上对外暴露一个 `QueryHandle<TArgs, TData>`：

| 方法 | 说明 |
|------|------|
| `getData(...args)` | 读缓存数据，无则返回 `undefined` |
| `getState(...args)` | 读原始缓存条目（data, error, fetchStatus, dataUpdatedAt） |
| `isFetching(...args)` | 是否正在 fetch |
| `isStale(...args)` | 缓存是否过期（data 缺失或超过 staleTime） |
| `fetch(...args)` | 发起 fetch，返回 Promise<TData> |
| `prefetch(...args)` | 预热缓存（同 fetch 但 swallow rejection） |
| `cancel(...args?)` | 取消指定 args 的 inflight；无参则取消该 query 所有 inflight |
| `invalidate(...args?)` | 标记过期（不清数据）；无参则标记该 query 所有 entry |
| `reset(...args?)` | 清除缓存条目；无参则清除该 query 所有 entry |
| `setData(data)` / `setData(...args, data)` | 手动写入缓存 |

`cancel`/`invalidate`/`reset` 无参时作用于该 query 的所有缓存 entry。

### 初始化流程

`_initQueries()` 遍历 `model.queries`，对每个 entry：
1. 调用 `_cacheAccess(queryName, QUERY)` 注册到 accessCache
2. Normalize spec（shorthand → `{ fn }`）
3. `_buildQueryHandle(queryName, spec)` 构造 handle 对象
4. 注册到 `this.queries`（proxy 可访问）和 `this._queryHandles`（getApi 遍历用）
5. 两份 record 都 `Object.freeze`，不可运行时追加

**_hasArgs 标志**：通过 `spec.fn.length > 1` 判断。有参 query 的 `setData` 签名为 `(...args, data)`；无参 query 的 `setData` 签名为 `(data)`。

### QueryCoordinator — 协调层

每个 `ModelManager` 持有一个共享的 `QueryCoordinator` 实例，协调所有 model 的 query 行为。

```
QueryCoordinator
├── FetchManager     去重 inflight request（按 hash 合并并发请求）
├── GCManager        引用计数 + 定时清理
└── config           { gcTime: 5min, staleTime: 0 }
```

**FetchManager 去重**：同一 hash 的并发 fetch 共享同一个 Promise。第二个调用者直接获得进行中的 Promise。fetch 完成（成功或失败）后清除记录。

**GCManager 引用计数**：
- `observeQuery(hash)` — 增加引用计数（React hook mount 时调用）
- `unobserveQuery(hash, cleanup)` — 减少引用计数。归零后启动 `gcTime` 定时器，到期执行 `cleanup`（清除缓存条目）

**为什么需要 GC？** query 缓存全局持有。如果所有消费者都 unmount 了，缓存条目仍占内存。GCManager 在最后一个观察者离开后 `gcTime`（默认 5 分钟）后清理。

### Query Hash 方案

```ts
computeQueryHash(scope, queryName, argsKey) → QueryHash (branded string)
```

- `scope`：命名 model 为 `model.name`；detached model 为 `@@detached:<id>`（自增 id）
- `queryName`：query 在 model 中的 key
- `argsKey`：`computeArgsKey(args)` 将 args tuple JSON 化为稳定字符串

hash 格式保证不同 store、不同 model、不同 args 之间缓存完全隔离。

### staleTime 解析优先级

```
hook 级 staleTime (QueryOverrides.staleTime)
  → spec 级 staleTime (query({ staleTime }))
    → 全局 staleTime (doura({ query: { staleTime } }))
      → 默认 0（每次都重新 fetch）
```

### model 级批量操作

| 方法 | 行为 |
|------|------|
| `$invalidateQueries()` | 标记该 model 所有 query 的所有 entry 过期 |
| `$cancelQueries()` | 取消该 model 所有 query 的所有 inflight fetch |
| `$resetQueries()` | 清除该 model 所有 query 的所有缓存 entry |

这三个操作通过 `_queryIndex`（前缀索引）定位属于当前 model 的所有 hash，然后逐一操作。
