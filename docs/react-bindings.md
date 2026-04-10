# React 集成

源码位置：`packages/react-doura/src/`

react-doura 通过 `useSyncExternalStore` 将 doura model 接入 React 渲染循环，配合 `unstable_batchedUpdates` 合并多个 model 变更触发的 re-render。

---

## 1. createContainer — Context + Provider

> `createContainer.tsx`

```ts
// createContainer.tsx:20-106（简化）
function createContainer(options?: DouraOptions) {
  const Context = createContext<{ store: Doura, batchManager }>()

  function Provider({ children, store: propsStore }) {
    const memoContext = useMemo(() => ({
      store: propsStore || doura(options),
      batchManager: createBatchManager()
    }), [propsStore])

    return <Context.Provider value={memoContext}>{children}</Context.Provider>
  }

  return { Provider, useSharedModel, useStaticModel }
}
```

- Provider 可接收外部 `store` prop（用于 SSR 或测试），也可自动创建
- 每个 Container 有独立的 `batchManager` 实例
- `useSharedModel` 和 `useStaticModel` 闭包持有 Context 引用

**返回值**:

| 导出 | 用途 |
|------|------|
| `Provider` | 挂载到组件树，提供 store context |
| `useSharedModel(name, model, selector?, depends?)` | 订阅 model 变更，触发 re-render |
| `useStaticModel(name, model)` | 获取 model 实例的只读引用，不触发 re-render |

---

## 2. useModel — 入口 hook

> `useModel.tsx`（未在上面的源码列出，但逻辑类似）

`useModel` 的两种调用模式：

```ts
// 有名 model → 委托给全局 root store 的 useRootModel
useModel('counter', counterModel, selector?)

// 匿名 model → 组件级独立 doura 实例
useModel(counterModel, selector?)
```

**匿名 model 的隔离**：每个组件通过 `useRef` 持有独立的 `doura()` 实例。model 生命周期与组件绑定，unmount 时销毁。

---

## 3. createUseModel — 核心 hook 逻辑

> `createUseModel.tsx`

### useModelInstance

`createUseModel.tsx:80-103`:

```ts
function useModelInstance(name, model, doura, batchManager) {
  const { modelInstance, subscribe } = useMemo(() => {
    const modelInstance = doura.getModel(name, model)
    return {
      modelInstance,
      subscribe: (onModelChange) =>
        batchManager.addSubscribe(modelInstance, onModelChange)
    }
  }, [name, doura])  // ← 注意：model 变更被故意忽略

  return { modelInstance, subscribe }
}
```

**为什么忽略 model 依赖？** model 对象是 `defineModel()` 返回的常量引用，但 React 热更新可能导致新的引用。忽略 model 变更避免不必要的实例重建。

### 无 selector 模式

`createUseModel.tsx:38-49`:

```ts
function useModel(model, subscribe) {
  const view = useMemo(() => () => model.$getApi(), [model])
  return useSyncExternalStore(subscribe, view, view)
}
```

`$getApi()` 返回 `{ ...state, ...views, actions }`。每次 state 变更后 `_api` 被置空（`model.ts:486`），下次调用重新构造。

### 有 selector 模式

`createUseModel.tsx:51-78`:

```ts
function useModelWithSelector(model, subscribe, selector, depends) {
  const view = useMemo(() => {
    // 销毁旧的 ModelView
    if (preMv) preMv.destory()
    // 创建新的 ModelView
    return model.$createView(selector)
  }, [model, ...(depends || [selector])])

  return useSyncExternalStore(subscribe, view, view)
}
```

`$createView(selector)` 创建一个 `ViewImpl`，其 getter 就是 `selector(proxy)`。View 的 `getSnapshot()` 只在依赖变更时重新计算并生成 snapshot。

**为什么支持 `depends` 参数？** 当 selector 是内联函数时引用每次都变，`depends` 让调用者控制何时重建 view。

---

## 4. useStaticModel — 无订阅模式

> `createUseModel.tsx:129-148`

```ts
const createUseStaticModel = (doura) => (name, model) => {
  const modelInstance = useMemo(() => doura.getModel(name, model), [name, doura])

  const store = useMemo(() => {
    if (__DEV__) return readonlyModel(modelInstance)  // 开发模式包一层只读 proxy
    return modelInstance
  }, [modelInstance])

  return store
}
```

返回 model 的 `publicInst`，不订阅变更。适合只需要调用 action 而不需要读取 state 的场景（如事件处理器）。开发模式下包一层 `readonlyModel` proxy，防止意外修改。

---

## 5. BatchManager — 合并 React 更新

> `batchManager.ts`

### 数据结构

```ts
// batchManager.ts:4-10
const modelBindRender = new WeakMap<
  ModelPublicInstance,
  Set<() => void>         // 该 model 的所有 React 更新回调
>()
const douraUnSub = new WeakMap<ModelPublicInstance, () => void>()  // model 的 unsubscribe
```

### 订阅流程

`addSubscribe(model, fn)` (`batchManager.ts:13-32`):

```
首次订阅某 model:
  1. 创建 Set<callback>
  2. model.$subscribe(onChange) → triggerSubscribe(model)
  3. 存储 unsubscribe 函数

后续订阅:
  4. fn 加入已有的 Set
```

### 触发流程

`triggerSubscribe(model)` (`batchManager.ts:54-68`):

```ts
function triggerSubscribe(model) {
  const updateList = Array.from(modelBindRender.get(model) || [])

  unstable_batchedUpdates(() => {
    while (updateList.length) {
      updateList.pop()!()   // 执行所有 React 更新回调
    }
  })
}
```

**为什么用 `unstable_batchedUpdates`？** 一个 model 可能被多个组件订阅。model 变更时如果逐个触发 `setState`，React 会为每个组件单独 re-render。`unstable_batchedUpdates` 将它们合并为一次批量更新。

### 自动清理

`removeSubscribe` (`batchManager.ts:35-51`): 当某个 model 的最后一个 subscriber 被移除时，调用存储的 `unsubscribe` 函数取消 model 订阅，并清理 WeakMap entries。

---

## 完整数据流

```
用户调用 action
    │
    ▼
ModelInternal._initActions 中的 wrapper
    │  action.call(this.proxy, ...args)
    │  depth=0 → invalidateJob + _update()
    │
    ▼
dispatch(MODIFY) → snapshot() → 新 _currentState → _api = null
    │
    ▼
_subscribers 通知 → batchManager.triggerSubscribe(model)
    │
    ▼
unstable_batchedUpdates 内触发所有组件的 onStoreChange
    │
    ▼
useSyncExternalStore 调用 getSnapshot()
    │
    ├── 无 selector: model.$getApi() → { ...state, ...views, ...actions }
    └── 有 selector: view.getSnapshot() → snapshot(selector result)
    │
    ▼
React re-render（如果 snapshot 引用变了）
```
