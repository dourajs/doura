# Model 系统

源码位置：`packages/doura/src/core/`

Model 是 doura 的核心抽象单元。一个 model 定义了 state + actions + views，由 `ModelInternal` 实例化并管理运行时生命周期。

---

## 1. defineModel — 类型收窄

> `core/defineModel.ts`

`defineModel({ state, actions?, views? })` 是一个 **identity function**，零运行时开销。它的唯一作用是为 TypeScript 提供类型推断：action 中 `this` 的类型、view 的返回类型、`useModel` 的结果类型。

两种 model 形式：

- **ObjectModel**: `defineModel({ state, actions, views })` — 直接声明
- **FunctionModel**: `defineModel(() => { use(...); return { state, actions, views } })` — 函数形式，支持 `use()` 组合

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

  // 4. 初始化 actions 和 views
  this._initActions()
  this._initViews()
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

    // 按优先级查找：accessCache → state → views → actions → ctx → $ 属性
    ...
  }
```

### accessCache

`modelPublicInstance.ts:76-94`: 首次访问某个 key 时确定它是 STATE/VIEW/ACTION/CONTEXT 哪种类型，缓存到 `accessCache`。后续访问直接 switch 跳转，避免重复的 `hasOwn` 检查。

### $ 前缀属性

`modelPublicInstance.ts:42-59` 的 `publicPropertiesMap` 路由了所有 `$` 开头的属性：

```ts
$name    → instance.name
$rawState → instance.getState()    // snapshot
$state   → instance.stateValue     // draft（供 action 内部使用）
$actions → instance.actions
$views   → instance.views
$patch   → instance.patch
$onAction → instance.onAction
$subscribe → instance.subscribe
$isolate  → instance.isolate
$getApi   → instance.getApi
$createView → createView.bind(null, instance)
```

### set handler

`modelPublicInstance.ts:115-180`：

- `state` 属性 → 写入 draft（VIEW context 中禁止写入）
- `actions/views` → 只读，拒绝修改
- `$state` → 触发 `instance.replace(value)` 整体替换
- 其他 `$` 属性 → 只读
- 其余 → 写入 `ctx`

---

## 4. Model 组合 — use()

> `core/use.ts`, `core/modelManager.ts:78-82, 128-140, 174-189`

### 原理

FunctionModel 允许通过 `use(name, otherModel)` 组合其他 model：

```ts
const parentModel = defineModel(() => {
  const [state, actions] = use('child', childModel)
  return {
    state: { ... },
    actions: {
      doSomething() {
        actions.childAction()  // 调用子 model action
      }
    }
  }
})
```

### 实现机制

1. `ModelManager.getModelInstance()` (`modelManager.ts:121-148`) 在执行 FunctionModel 前，创建 `ModelProxy` 并设置 `currentModelContext`：

```ts
const modelProxy = this._createModelProxy()
setCurrentModelContext({ manager: this, model: modelProxy })
instance = this._initModel({ name, model: model() })  // 执行函数
modelProxy.setModel(instance)                            // 建立依赖
```

2. 函数体内调用 `use(name, model)` (`use.ts`)：
   - 从 `currentModelContext` 获取 manager 和 modelProxy
   - `manager.getModelInstance({ name, model })` 获取或创建子 model
   - `modelProxy.addChild(childInstance)` 注册子 model

3. 函数执行完毕后，`modelProxy.setModel(parentInstance)` 对所有 children 调用 `parentInstance.depend(child)` (`modelManager.ts:180-186`)

4. `model.depend(dep)` (`model.ts:345-355`): subscribe 到 child 的变更事件，转发给 parent 的 subscribers

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

- `getModel(name, model)` — 按名缓存。相同 name 返回同一个实例
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

Plugin 通过 `onModelInstance` 拿到 `ModelPublicInstance`，可以调用 `$subscribe`、`$onAction` 等 API 扩展行为。
