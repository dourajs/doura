# Doura 架构设计

## 一句话定位

**Immer 的 copy-on-write draft + Vue 3 的细粒度依赖追踪 = 可变写入，不可变消费。**

用户在 action 里直接修改 `this.xxx`（写入 mutable draft proxy），外部消费者始终拿到 structural sharing 的 immutable snapshot。

## 包依赖关系

```
doura (核心)
  ├── reactivity/    Draft、Snapshot、Effect、View
  ├── core/          Model、Scheduler、Plugin、ModelManager
  └── doura.ts       工厂函数

react-doura (React 集成，peer: doura)
  ├── createContainer    Context + Provider
  ├── DouraRoot          预构建的全局 Provider（dev 模式自动注入 devtool）
  ├── createUseModel     useSyncExternalStore 驱动
  └── useQuery / useAction / useInfiniteQuery  Query/Action React 集成

doura-plugin-log    (peer: doura)  Action 日志
doura-plugin-persist (peer: doura) 持久化 + 迁移
```

## 数据流全景

```
defineModel({ name, state, actions, views, queries, models })
        │
        ▼
  ModelInternal 构造
        │
        ├── draft({ value: initState })          ← 创建可变 Proxy
        ├── watch(stateRef, () => queueJob(_update))  ← 监听 draft 变更
        ├── new Proxy(ctx, InternalInstanceProxyHandlers)  ← action/view 的 this
        └── new Proxy(ctx, PublicInstanceProxyHandlers)    ← 外部 API
        │
        ▼
  Action 调用
        │
        ├── this.xxx = value       ← 写入 draft (prepareCopy → markChanged)
        ├── track()/trigger()      ← 细粒度依赖追踪
        └── depth=0 时同步刷新:
              invalidateJob(_update)
              _update() → dispatch(MODIFY) → snapshot() → 新 immutableState
        │
        ▼
  消费者（React hook / subscribe）
        │
        └── useSyncExternalStore(subscribe, getSnapshot)
              └── getSnapshot 返回 snapshot proxy（结构共享）

  Query 路径（并行于 action 同步路径）
        │
        ├── queryHandle.fetch(args) → QueryCoordinator → FetchManager 去重
        ├── fetch 完成 → model.setQueryData → setQueryState → notifyQueryListeners
        └── useQuery 订阅 → useSyncExternalStore → React re-render
```

## 文档导航

| 文档 | 内容 |
|------|------|
| [reactivity.md](./reactivity.md) | 响应式系统：Draft、Snapshot、Effect、View |
| [model.md](./model.md) | Model 系统：定义、实例化、两层 Proxy、models 组合、Query 系统 |
| [scheduler.md](./scheduler.md) | 调度器：微任务队列、同步刷新策略 |
| [react-bindings.md](./react-bindings.md) | React 集成：Container、DouraRoot、useModel、useDetachedModel、useQuery、useAction、useInfiniteQuery |
