# React 集成

源码位置：`packages/react-doura/src/`

react-doura 通过 `useSyncExternalStore` 将 doura model 接入 React 渲染循环，直接使用 model 的 `$subscribe` 机制监听变更。

---

## 1. createContainer — Context + Provider

> `createContainer.tsx`

```ts
// createContainer.tsx（简化）
function createContainer(options?: DouraOptions) {
  const Context = createContext<{ store: Doura }>()

  function Provider({ children, store: propsStore }) {
    const memoContext = useMemo(() => ({
      doura: { store: propsStore || doura(options) },
      ownsStore: !propsStore,
    }), [propsStore])

    // 同时提供局部 Context 和全局 DouraContext
    return (
      <DouraContext.Provider value={memoContext.doura}>
        <Context.Provider value={memoContext.doura}>{children}</Context.Provider>
      </DouraContext.Provider>
    )
  }

  // 所有 hook 从局部 Context 读取 store，再委托给 *Impl 函数
  const useSharedModel = (model, selector?, depends?) => {
    const context = useDouraContext() // 局部 Context
    return useModelImpl(context, model, selector, depends)
  }

  const useQuery = (queryHandle, argsOrOptions?, maybeOptions?) => {
    const context = useDouraContext()
    return useQueryImpl(context, queryHandle, argsOrOptions, maybeOptions)
  }

  // useStaticModel, useAction, useInfiniteQuery 同理...

  return { Provider, useSharedModel, useStaticModel, useQuery, useAction, useInfiniteQuery }
}
```

- Provider 可接收外部 `store` prop（用于 SSR 或测试），也可自动创建
- Provider 同时写入局部 `Context` 和全局 `DouraContext`，因此 `useModel` 和 container 内的 `useSharedModel` 共享同一份 store
- 自动管理 store 生命周期：内部创建的 store 在 Provider unmount 时通过 `nextTick` 延迟销毁（应对 StrictMode 双 mount）

**返回值**:

| 导出                                         | 用途                                        |
| -------------------------------------------- | ------------------------------------------- |
| `Provider`                                   | 挂载到组件树，提供 store context            |
| `useSharedModel(model, selector?, depends?)` | 订阅 model 变更，触发 re-render             |
| `useStaticModel(model)`                      | 获取 model 实例的只读引用，不触发 re-render |
| `useQuery(query, args?, options?)`           | 订阅 query 状态，自动 fetch                 |
| `useAction(action, options?)`                | 追踪 action 生命周期                        |
| `useInfiniteQuery(query, config)`            | 分页 query，累积页面                        |

---

## 2. DouraRoot — 全局 Provider

> `global.ts`

```ts
// global.ts
const {
  Provider: DouraRoot,
  useSharedModel: useRootModel,
  useStaticModel: useRootStaticModel,
  useQuery: useRootQuery,
  useAction: useRootAction,
  useInfiniteQuery: useRootInfiniteQuery,
} = createContainer({
  plugins: __DEV__ ? [[devtool]] : [],
})
```

`DouraRoot` 是预构建的全局 Provider，本质上就是 `createContainer` 的 `Provider`。开发模式下自动注入 `devtool` 插件。所有全局 hook（`useModel`、`useQuery`、`useAction`、`useInfiniteQuery` 等）都来自这个全局 container，因此**必须在组件树中有 `<DouraRoot>` 祖先**。

**为什么不让用户自己 createContainer？** 大多数应用只需要一个全局 store。`DouraRoot` 提供开箱即用的体验，减少样板代码。需要多 store 隔离（SSR、微前端等）时再使用 `createContainer`。

使用：

```tsx
<DouraRoot>
  <App />
</DouraRoot>
```

---

## 3. 入口 hooks — useModel / useDetachedModel / useStaticModel

> `useModel.tsx`

三个 hook 从 `useModel.tsx` 导出：

### useModel

```ts
const useModel: UseModel = (model, selector?, depends?) => {
  return useRootModel(model, selector, depends)
}
```

委托给全局 `DouraRoot` 的 `useSharedModel`。要求祖先组件树中有 `<DouraRoot>`。model 身份由 `model.$options.name` 确定，不需要单独传 name 参数。

### useDetachedModel

```ts
const useDetachedModel: UseDetachedModel = (model, selector?, depends?) => {
  const context = useRef<{ douraStore: Doura } | null>(null)

  if (!context.current) {
    context.current = { douraStore: doura() } // 组件级独立 store
  }

  return useModelImpl({ store: context.current.douraStore }, model, selector, depends)
}
```

**组件级隔离**：每个组件通过 `useRef` 持有独立的 `doura()` 实例，不与其他组件共享。model 生命周期与组件绑定。

**为什么不需要显式 destroy？** detached store 通过 `doura()` 创建时不传 plugins，没有 `onDestroy` 钩子或外部订阅。所有资源（draft watchers、effect scope、model state）仅通过 `useRef` 可达，组件 unmount 后自动 GC。View 的清理由 `useModelWithSelector` 自身的 `useEffect` 处理。

### useStaticModel

```ts
const useStaticModel: UseStaticModel = (model) => {
  return useRootStaticModel(model)
}
```

无订阅读取。适合只需调用 action 而不关心 state 变化的场景（如事件处理器）。

---

## 4. useModelImpl — 核心 hook 逻辑

> `useModel.tsx`

### useModelInstance

```ts
// useModel.tsx
function useModelInstance(model, doura) {
  const modelKey = getModelCacheKey(model) // → model.$options.name
  const { modelInstance, subscribe } = useMemo(() => {
    const modelInstance = doura.getModel(model)
    return {
      modelInstance,
      subscribe: (onModelChange) =>
        modelInstance.$subscribe(() => onModelChange()), // 直连 $subscribe
    }
  }, [doura, modelKey])

  return { modelInstance, subscribe }
}
```

**为什么 modelKey 而非 model 对象？** model definition 是 `defineModel()` 返回的常量引用，但 React 热更新可能导致新的引用。使用 `model.$options.name` 作为 key 避免不必要的实例重建，同时让 `store.getModel(model)` 仍按当前 definition 初始化。

### 无 selector 模式

```ts
function useModel(model, subscribe) {
  const view = useMemo(() => () => model.$getApi(), [model])
  return useSyncExternalStore(subscribe, view, view)
}
```

`$getApi()` 返回 `ModelAPI`：`{ ...state, ...views, ...actions, ...queryFetches }`。`ModelAPI` 不包含 query handle map、child models 或 `$models`；query handles 和 child models 只在 `store.getModel()` 返回的 `ModelInstance` 上直接可见。每次 state 变更后 `_api` 被置空，下次调用重新构造。

### 有 selector 模式

```ts
function useModelWithSelector(model, subscribe, selector, depends) {
  const selectorRef = useRef<ModelView>()
  const prevRef = useRef({ depends, selector, model })
  const prev = prevRef.current

  // 手动 diff 判断是否需要重建 view
  let needsRecreate = !selectorRef.current || prev.model !== model
  if (!needsRecreate) {
    if (depends !== undefined) {
      needsRecreate = !shallowArrayEqual(prev.depends, depends)
    } else {
      needsRecreate = prev.selector !== selector
    }
  }

  if (needsRecreate) {
    selectorRef.current?.destroy()
    selectorRef.current = model.$createView(selector)
  }

  prevRef.current = { depends, selector, model }

  // StrictMode 安全：cleanup 销毁 view，再次 setup 时重建
  useEffect(() => {
    if (!selectorRef.current) {
      selectorRef.current = model.$createView(selector)
    }
    return () => {
      selectorRef.current?.destroy()
      selectorRef.current = undefined
    }
  }, [])

  const getSnapshot = useMemo(() => () => selectorRef.current!(), [model])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
```

**为什么用 `useRef` + 手动 diff 而非 `useMemo` with deps？** `useMemo` 在 React 并发模式下不保证稳定（React 可能丢弃缓存），而 view 生命周期需要显式 `destroy()` 管理。手动 ref diffing 确保：

1. view 只在真正需要时重建
2. 旧 view 总是被显式销毁
3. StrictMode 的 cleanup-rerun 模式正确处理

**`depends` 参数的作用**：当 selector 是内联函数时引用每次都变。`depends` 让调用者控制何时重建 view，类似 `useCallback` 的 deps。

---

## 5. useStaticModelImpl — 无订阅模式

> `useModel.tsx`

```ts
function useStaticModelImpl(context: { store: Doura }, model) {
  const { modelInstance } = useModelInstance(model, context.store)
  return modelInstance as ModelAPI
}
```

返回 model 的 `publicInst`，不订阅变更。开发模式下 `useModelInstance` 内部包一层 `readonlyModel` proxy，set trap 输出警告，防止意外修改。

---

## 6. useQuery — 订阅 query 状态

> `useQuery.ts`

### 签名

```ts
// 无参 query
useQuery<TData, TSelected>(
  query: QueryFetch<[], TData> | QueryHandle<[], TData>,
  options?: QueryOverrides<TData, TSelected>
): UseQueryResult<TData, TSelected>

// 有参 query
useQuery<TArgs, TData, TSelected>(
  query: QueryFetch<TArgs, TData> | QueryHandle<TArgs, TData>,
  args: TArgs,
  options?: QueryOverrides<TData, TSelected>
): UseQueryResult<TData, TSelected>
```

### 重载消歧

运行时先用 `resolveQueryHandle(query, context)` 统一解析输入：

- bound `QueryFetch`（例如 `api.fetchUser`）通过内部标记还原到它的 `QueryHandle`
- `QueryHandle`（例如 model instance 上的 `instance.$queries.fetchUser`）直接使用
- definition ref（例如 `userModel.fetchUser`）必须在 Provider context 下解析为当前 store 的 handle

随后通过 `queryHandleInternal._hasArgs` 标志（而非参数个数检测）区分重载。无参 query 的 `_hasArgs = false`，此时第二个参数解读为 `options`。Provider 的 `store` prop 切换后，definition ref 会重新绑定到新 store。

### QueryOverrides

| 选项              | 类型                         | 说明                            |
| ----------------- | ---------------------------- | ------------------------------- |
| `enabled`         | `boolean \| () => boolean`   | 控制是否自动 fetch。默认 `true` |
| `staleTime`       | `number`                     | 覆盖 spec/全局的过期时间（ms）  |
| `select`          | `(data: TData) => TSelected` | 对真实数据做派生转换            |
| `placeholderData` | `TData \| (prev?) => TData`  | 真实数据到达前的占位值          |

### UseQueryResult

| 字段                | 说明                                        |
| ------------------- | ------------------------------------------- |
| `data`              | 转换后数据（select 结果）或 placeholderData |
| `error`             | 最近一次 fetch 错误                         |
| `isLoading`         | 首次加载中（无数据 + 无错误 + enabled）     |
| `isPending`         | 无数据                                      |
| `isFetching`        | 正在 fetch（含后台刷新）                    |
| `isSuccess`         | 有数据且无错误                              |
| `isError`           | 有错误                                      |
| `isStale`           | 数据已过期                                  |
| `isRefetching`      | 有数据且正在后台刷新                        |
| `isPlaceholderData` | 当前展示的是 placeholder                    |
| `refetch`           | 手动重新 fetch                              |

### 生命周期

```
mount / args 变更
    │
    ├── queryHandleInternal.observe(args)    ← 向 GCManager 注册观察者
    │
    ├── enabled && isStale(entry)?
    │     └── yes → queryHandle 的 fetch 方法  ← 触发 fetch（FetchManager 去重）
    │
    └── return cleanup:
          unobserve(args, () => reset(args)) ← 解除观察，gcTime 后清理缓存
```

### 订阅方式

```ts
const subscribe = useCallback(
  (cb) => queryHandleInternal.subscribe(argsRef.current, cb),
  [queryHandleInternal, hash] // hash 从 args tuple 稳定计算
)
useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
```

**为什么用 hash 而非 args 引用作 dep？** 内联 `[id]` 数组每次 render 都是新引用，但 hash 内容相同时无需重新订阅。`computeHash(...args)` 产生稳定字符串 key。

---

## 7. useAction — 追踪 async action 生命周期

> `useAction.ts`

### 签名

```ts
useAction<TFn>(
  action: TFn,
  options?: UseActionOptions<Awaited<ReturnType<TFn>>>
): UseActionResult<TFn>
```

### UseActionOptions

| 选项                     | 说明                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `onSuccess(data)`        | action 成功后回调                                                 |
| `onError(error)`         | action 失败后回调                                                 |
| `onSettled(data, error)` | action 结束后回调（无论成败）                                     |
| `pendingDelay`           | 进入 pending 状态的延迟（ms），默认 300。快速操作不会闪现 loading |

### UseActionResult

| 字段                                             | 说明                                                   |
| ------------------------------------------------ | ------------------------------------------------------ |
| `run(...args)`                                   | 触发 action，fire-and-forget（内部 swallow rejection） |
| `runAsync(...args)`                              | 触发 action，返回 Promise                              |
| `data`                                           | 最近成功的返回值                                       |
| `error`                                          | 最近的错误                                             |
| `isIdle` / `isPending` / `isSuccess` / `isError` | 状态标志                                               |
| `reset()`                                        | 重置为 idle 状态，取消进行中 run 的写入权限            |

### 设计要点

1. **同步 action 跳过 pending**：返回非 thenable 时，reducer 直接跳到 success/error，`isPending` 永远不会被观察到 `true`。

2. **pendingDelay 防闪烁**：异步 action 启动后，在 delay 窗口内旧的 `data`/`error` 保持可见。超过 delay 后（且 run 仍是最新的），原子性清除旧状态并翻转 `isPending = true`。

3. **runId 竞态保护**：每次 `run`/`runAsync` 调用递增 `runIdRef`。只有最新 runId 有权写入 state 和触发回调。旧的 inflight run 静默丢弃结果。

4. **状态隔离**：state 通过 `useReducer` 维护在 hook 实例内。两个组件对同一 action 使用 `useAction` 互相独立。

### Definition ref

`useAction(model.actionName)` 可直接接收 definition ref。hook 会从当前 Provider context 读取 store，并解析为 `store.getModel(model).actionName`。因此同一个组件树切换 Provider store 时，action ref 会随之重新绑定。

---

## 8. useInfiniteQuery — 分页 query

> `useInfiniteQuery.ts`

### 签名

```ts
useInfiniteQuery<TArgs, TData>(
  query: QueryFetch<TArgs, TData> | QueryHandle<TArgs, TData>,
  config: InfiniteQueryConfig<TArgs, TData>
): UseInfiniteQueryResult<TArgs, TData>
```

### InfiniteQueryConfig

| 字段                                    | 说明                                    |
| --------------------------------------- | --------------------------------------- |
| `initialArgs`                           | 首页的 args                             |
| `getNextArgs(lastPage, allPages)`       | 返回下一页 args，`undefined` 表示无更多 |
| `getPreviousArgs?(firstPage, allPages)` | 返回上一页 args（可选）                 |

### UseInfiniteQueryResult

| 字段                                                 | 说明                                               |
| ---------------------------------------------------- | -------------------------------------------------- |
| `data`                                               | `{ pages: TData[], args: TArgs[] }` 或 `undefined` |
| `error`                                              | 最近错误                                           |
| `isLoading` / `isFetching` / `isSuccess` / `isError` | 状态标志                                           |
| `hasNextPage` / `hasPreviousPage`                    | 是否有更多页                                       |
| `isFetchingNextPage` / `isFetchingPreviousPage`      | 分页 fetch 方向                                    |
| `fetchNextPage()` / `fetchPreviousPage()`            | 加载更多                                           |
| `refetch()`                                          | 重置为首页并重新加载                               |

### 设计要点

1. **页面累积在本地 state**：pages 存储在 `useReducer` 中，不订阅 query cache。这使得分页逻辑独立于全局缓存。

2. **per-page cache 写入 model store**：虽然 hook 内部不订阅缓存，但每页 fetch 仍然通过 model 的 QueryCoordinator 写入 cache entry。其他 `useQuery` 使用相同 args 时能直接命中。

3. **runId 竞态保护**：与 `useAction` 相同策略，每次 `fetchPage` 递增 runId，乱序返回静默丢弃。

4. **Provider store 切换重置**：如果传入的是 definition ref，Provider store 切换会解析出新的 handle；hook 会清空本地 pages，并用 `initialArgs` 重新加载首页。

5. **refetch 语义**：清空页面，只用 `initialArgs` 重新 fetch 一页。需要多页刷新时，调用者在 refetch 后再逐步 `fetchNextPage`。

---

## 9. 完整数据流

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
_subscribers 通知
    │
    ├── useModel / useSharedModel 路径:
    │     modelInstance.$subscribe(onModelChange)
    │         → onStoreChange (useSyncExternalStore 注册的回调)
    │         → getSnapshot() 返回新值
    │         → React re-render（如果 snapshot 引用变了）
    │
    └── useQuery 路径:
          queryFetch(args) 或 $queries.queryName 的 fetch 方法
              → QueryCoordinator.FetchManager 去重
              → fetch 完成 → setQueryState(entry)
              → _notifyQueryListeners
              → queryHandleInternal.subscribe callback
              → useSyncExternalStore → React re-render
```
