# Model 系统

源码位置：`packages/doura/src/core/`

Model 是 doura 的核心抽象单元。一个 model definition 定义了 state + actions + views + queries + child models，由 `ModelInternal` 实例化并管理运行时生命周期。

---

## 1. defineModel — 类型收窄

> `core/defineModel.ts`

`defineModel({ name, state, models?, actions?, views?, queries? }, setup?)` 主要作用是为 TypeScript 提供类型推断：action 中 `this` 的类型、view 的返回类型、组合 model 的实例类型、query fetch/handle 的参数与返回值、`useModel` 的结果类型。运行时做三件事：1) 调用 `decorateModelQueries` 将 query 函数规范化为内部 `{ fn }` 结构；2) 在 define 阶段检查 state/models/views/actions/queries 的 key 冲突、重复 child model、`$options` definition ref 命名冲突；3) 如果提供了 `setup` 回调则执行它（用于 `model.setQueryOptions`）。返回 `ModelDefinition` wrapper，原始 model options 保存在非枚举的 `definition.$options`。

Store 只接受 `defineModel()` 返回的 `ModelDefinition`。原始 object/function model 不能直接传给 `store.getModel()` 或 `getDetachedModel()`：

- **Model**: `{ name, state, models, actions, views, queries }`
- **ModelDefinition**: `defineModel(model, setup?)` 的返回值
- **definition.$options**: 原始 options；`$options` 是 definition 的保留字段
- `models: [childModel]` 使用子 model 的 `childModel.$options.name` 作为 key，暴露为 `this.childName`、`instance.childName` 和 `instance.$models.childName`
- `definition.actionName` / `definition.queryName` 是 React hooks 可解析的 definition ref；必须在 Provider context 下绑定到当前 store

---

## 2. ModelInternal — 运行时实例

> `core/model.ts`

### 构造流程

```ts
// model.ts（简化）
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

`model.ts:654-684` 的 `_initActions()`：

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

**为什么 depth=0 时同步刷新？** 如果依赖 microtask 延迟刷新，调用者在 action 返回后立即读取 state 会拿到旧值。同步 `invalidateJob` + `_update` 保证 action 完成后 snapshot 立即可用。这也防止了 [valtio#270](https://github.com/pmndrs/valtio/issues/270) 类似的问题（注释见 `model.ts:644`）。

**为什么用 depth 计数？** 嵌套 action（action A 调用 action B）只在最外层完成时刷新一次，避免中间状态产生不必要的 snapshot。

### \_update — 状态转换

`model.ts:595-604`：

```ts
_update() {
  if (this._destroyed || !isModified(this.stateRef)) return
  this.dispatch({ type: ActionType.MODIFY })
  markUnchanged(this.stateRef)           // 重置 modified 标记
}
```

### dispatch — 状态分发

`model.ts:511-547`：

1. `this.reducer(currentState, action)` — 根据 action type 生成新 state
2. 引用比较 `nextState !== currentState`
3. 更新 `_currentState`，清空 `_api` 缓存
4. 触发 `_subscribers`

### reducer

`model.ts:494-508`：

| Action Type | 行为                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `MODIFY`    | `snapshot(stateRef.value, stateRef.value, lastDraftToSnapshot)` — 从 draft 生成不可变 snapshot |
| `PATCH`     | 同 MODIFY（patch 已在 `patch()` 方法中直接修改了 draft）                                       |
| `REPLACE`   | 直接返回 `action.payload`（新的 plain object）                                                 |

`lastDraftToSnapshot` 是 snapshot 缓存 Map，实现跨 dispatch 的结构共享。

---

## 3. 两层 Proxy 设计

> `core/modelPublicInstance.ts`

### 为什么需要两层？

- **Internal Proxy** (`InternalInstanceProxyHandlers`): action/view 内部的 `this`。读取 `stateValue`（可变 draft），允许直接修改。
- **Public Proxy** (`PublicInstanceProxyHandlers`): 外部消费者的 API。读取 `getState()`（不可变 snapshot），不可直接修改。

两者共用同一个 `set` handler，但 `get` handler 的数据源不同：

```ts
const createGetter = (isPublicInstance: boolean) =>
  ({ _: instance }, key) => {
    // public 读 getState()（snapshot），internal 读 stateValue（draft）
    let state = isPublicInstance ? instance.getState() : instance.stateValue

    // 按优先级查找：state → accessCache → views/actions/queryFetches/models/ctx → $ 属性
    ...
  }
```

### accessCache

首次访问某个 key 时确定它是 STATE/VIEW/ACTION/QUERY/MODEL/CONTEXT 哪种类型，缓存到 `accessCache`。后续访问直接 switch 跳转，避免重复的 `hasOwn` 检查。

### $ 前缀属性

`publicPropertiesMap` 路由了所有 `$` 开头的属性：

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

`$getApi()` 构造的是 `ModelAPI` snapshot，用于 React `useModel()`、`useStaticModel()` 和 selectors。它只包含 state、views、actions、direct query fetches 与 `$queries`；不包含 child models 或 `$models`。`store.getModel()` 返回的 `ModelInstance` 仍然保留 `instance.childName` 与 `instance.$models.childName`。

### set handler

`modelPublicInstance.ts` set handler：

- `state` 属性 → 写入 draft（VIEW context 中禁止写入）
- `actions/views/queries/models` → 只读，拒绝修改
- 普通 `queryName` 访问 → 返回 `queryFetches[queryName]`，即直接 fetch 函数
- `$queries.queryName` → 返回完整 `QueryHandle`
- `$state` → 触发 `instance.replace(value)` 整体替换
- 其他 `$` 属性 → 只读
- 其余 → 写入 `ctx`

---

## 4. Model 组合 — models

> `core/modelManager.ts`, `core/model.ts`

### 原理

Model options 允许通过 `models: [otherModel]` 组合其他 model definition。子 model 使用自己的 `childModel.$options.name` 作为父实例上的 key：

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

> `core/modelManager.ts`

ModelManager 是 model 实例的注册中心。公开 API 只接收 `ModelDefinition`：

- `getModel(modelDefinition)` — 按 `definition.$options.name` 缓存。相同 name 返回同一个实例
- `getDetachedModel(modelDefinition)` — 匿名实例，不缓存，也不进入 `getState()`
- `subscribe(fn)` — 任何 model 变更时触发（通过 `queueJob` 合并）

### Plugin 生命周期

`modelManager.ts`:

```
constructor:  hooks.onInit({ initialState }, { doura })
_initModel:   hooks.onModel(name, model, { doura })
              hooks.onModelInstance(publicInst, { doura })
destroy:      hooks.onDestroy()
```

Plugin 的 `onModel(name, modelOptions, ctx)` 接收原始 options；`onModelInstance(instance, ctx)` 接收 `ModelInstance`，可以调用 `$subscribe`、`$onAction`、`$queries` 等 API 扩展行为。

---

## 6. Query 系统

> `core/model.ts`（\_initQueries, \_buildQueryHandle）、`core/queryCoordinator.ts`、`core/queryTypes.ts`

Query 系统为 model 提供声明式的异步数据获取能力，支持缓存、去重、过期控制和垃圾回收。

### defineModel queries 选项

```ts
const userModel = defineModel(
  {
    name: 'user',
    state: { users: {} as Record<string, User> },
    queries: {
      fetchUser: async function (ctx, id: string) {
        return await api.getUser(id)
      },

      fetchList: async function (ctx, page: number) {
        return await api.getUserList(page)
      },
    },
  },
  ({ model }) => {
    model.setQueryOptions('fetchUser', {
      onData({ api, args, data }) {
        api.users[args[0]] = data // sync fetched user into state
      },
    })
    model.setQueryOptions('fetchList', { staleTime: 30_000 })
  }
)
```

**声明方式**：

- `queries` 中每个 entry 都是函数：`(ctx: QueryCtx, ...args) => Promise<TData>`
- 每个 query 的 options 通过 `defineModel` 第二参配置：`model.setQueryOptions('fetchList', { staleTime, onData })`

不要在 `queries` 中写 `{ fn }` 对象；query entry 必须直接是函数。

**QueryOptions**：

| 选项        | 类型                       | 说明                                            |
| ----------- | -------------------------- | ----------------------------------------------- |
| `staleTime` | `number`                   | 数据新鲜期（ms），默认 `0`（每次都 stale）      |
| `onData`    | `(ctx: OnDataCtx) => void` | 数据到达回调（fetch 完成或 setData 调用时触发） |

**OnDataCtx**：`{ api: ModelThis, args: TArgs, data: TData }`

`onData` 在 action context 中执行，可以修改 state、调用 action。query cache 在 `onData` 完成后自动更新。与直接在 query 函数内部 `this.xxx = data` 相比，`onData` 的优势是 `setData()` 手动写入也会触发它，确保状态与缓存始终同步。

**fn 签名**：`fn(this: void, ctx: QueryCtx, ...args: TArgs): Promise<TData>`

- `this` 不绑定到 model proxy — query 函数以 `undefined` 为 `this` 调用
- `ctx.signal` 是 `AbortSignal`，fetch 被取消时会 abort
- 如需在数据到达时修改 state，使用 `onData` 回调（它提供 `api` 代理可修改 state）

### QueryFetch 与 QueryHandle

每个 query 在运行时拆成两个公开入口：

- `instance.queryName` / action 内 `this.queryName`：`QueryFetch<TArgs, TData>`，直接调用后返回 `Promise<TData>`
- `instance.$queries.queryName` / action 内 `this.$queries.queryName`：`QueryHandle<TArgs, TData>`，用于读缓存、预取、取消、失效、重置、手动写入缓存

```ts
actions: {
  async loadUser(id: string) {
    const user = await this.fetchUser(id)
    this.users[id] = user
  },
  refreshUser(id: string) {
    this.$queries.fetchUser.invalidate(id)
  },
}
```

`QueryHandle<TArgs, TData>` 方法：

| 方法                                       | 说明                                                        |
| ------------------------------------------ | ----------------------------------------------------------- |
| `getData(...args)`                         | 读缓存数据，无则返回 `undefined`                            |
| `getState(...args)`                        | 读原始缓存条目（data, error, fetchStatus, dataUpdatedAt）   |
| `isFetching(...args)`                      | 是否正在 fetch                                              |
| `isStale(...args)`                         | 缓存是否过期（data 缺失或超过 staleTime）                   |
| `fetch(...args)`                           | 发起 fetch，返回 Promise<TData>                             |
| `prefetch(...args)`                        | 预热缓存（同 fetch 但 swallow rejection）                   |
| `cancel(...args?)`                         | 取消指定 args 的 inflight；无参则取消该 query 所有 inflight |
| `invalidate(...args?)`                     | 标记过期（不清数据）；无参则标记该 query 所有 entry         |
| `reset(...args?)`                          | 清除缓存条目；无参则清除该 query 所有 entry                 |
| `setData(data)` / `setData(...args, data)` | 手动写入缓存（如配置了 `onData` 也会触发它）                |

`cancel`/`invalidate`/`reset` 无参时作用于该 query 的所有缓存 entry。

**setData 与 onData 的交互**：调用 `setData` 时，如果该 query 配置了 `onData` 回调，会先在 action context 中执行 `onData({ api, args, data })`，然后写入 query cache。这确保无论数据来自 fetch 还是手动写入，状态都保持同步。

### 初始化流程

`_initQueries()` 遍历 `model.queries`，对每个 entry：

1. 跳过非 `isQuerySpecLike` 的 entry（`decorateModelQueries` 已将函数规范化为 `{ fn }` 结构）
2. 调用 `_cacheAccess(queryName, QUERY)` 注册到 accessCache
3. `_buildQueryHandle(queryName, spec)` 构造 handle 对象
4. 注册到 `this.queries[queryName]`
5. 将 `handle.fetch` 打上内部 handle 标记，注册到 `this.queryFetches[queryName]`
6. `Object.freeze(this.queries)` 和 `Object.freeze(this.queryFetches)`，不可运行时追加

**\_hasArgs 标志**：通过 `spec.fn.length > 1` 判断。有参 query 的 `setData` 签名为 `(...args, data)`；无参 query 的 `setData` 签名为 `(data)`。

### QueryCoordinator — 协调层

每个 `ModelManager` 持有一个共享的 `QueryCoordinator` 实例，协调所有 model 的 query 行为。

```
QueryCoordinator
├── FetchManager     去重 inflight request（按 hash 合并并发请求）
├── GCManager        引用计数 + 定时清理
└── config           { gcTime: 5min, staleTime: 0 }
```

**QueryCoordinator 去重**：`_appliedInflight` 索引记录了所有进行中的 fetch。同一 hash 的并发调用直接返回已进行中的 Promise，不会发起重复请求。fetch 完成（成功或失败）后从索引中清除。FetchManager 本身是底层执行器，内部对重复 hash 有断言保护（不应直接调用两次）。

**GCManager 引用计数**：

- `observeQuery(hash)` — 增加引用计数（React hook mount 时调用）
- `unobserveQuery(hash, cleanup)` — 减少引用计数。归零后启动 `gcTime` 定时器，到期执行 `cleanup`（清除缓存条目）

**为什么需要 GC？** query 缓存全局持有。如果所有消费者都 unmount 了，缓存条目仍占内存。GCManager 在最后一个观察者离开后 `gcTime`（默认 5 分钟）后清理。

### Query Hash 方案

```ts
computeQueryHash(scope, queryName, argsKey) → QueryHash (branded string)
```

- `scope`：命名 model 为 `definition.$options.name`；detached model 为 `@@detached:<id>`（自增 id）
- `queryName`：query 在 model 中的 key
- `argsKey`：`computeArgsKey(args)` 将 args tuple JSON 化为稳定字符串

hash 格式保证不同 store、不同 model、不同 args 之间缓存完全隔离。

### staleTime 解析优先级

```
hook 级 staleTime (QueryOverrides.staleTime)
  → query options staleTime (model.setQueryOptions)
    → 全局 staleTime (doura({ query: { staleTime } }))
      → 默认 0（每次都重新 fetch）
```

### model 级批量操作

| 方法                   | 行为                                          |
| ---------------------- | --------------------------------------------- |
| `$invalidateQueries()` | 标记该 model 所有 query 的所有 entry 过期     |
| `$cancelQueries()`     | 取消该 model 所有 query 的所有 inflight fetch |
| `$resetQueries()`      | 清除该 model 所有 query 的所有缓存 entry      |

这三个操作通过 `_queryIndex`（前缀索引）定位属于当前 model 的所有 hash，然后逐一操作。
