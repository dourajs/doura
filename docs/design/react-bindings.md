 Snapshot 在 model 系统中的完整流程

  1. Draft 结构

  // model.ts:216
  this.stateRef = draft({ value: this._initState })

  stateRef 是一个 wrapper draft { value: actualState }。stateRef.value 是实际的 state draft proxy。

  2. Action 触发 snapshot

  user calls action → action 修改 this.xxx（draft）
  → actionDepth 回到 0 → invalidateJob + _update()
  → _update() 检查 isModified → dispatch({ type: MODIFY })
  → reducer() 调用 snapshot()

  关键代码（model.ts:417-424）：

  reducer(state, action) {
    case ActionType.MODIFY: {
      const draftToSnapshot = new Map(this._lastDraftToSnapshot)
      this._lastDraftToSnapshot = draftToSnapshot
      return snapshot(
        this.stateRef.value,      // value = draft proxy
        this.stateRef.value,      // draft = 同一个 draft proxy
        this._lastDraftToSnapshot // snapshots = 上次的缓存 Map
      )
    }
  }

  因为传了 snapshots（第三个参数），永远走 slow path，即使 value ===

  3. Snapshot 结果

  snapshot() 返回一个 snapshot Proxy。存入 _currentState。

  _setState(newState) {
    this._currentState = newState  // snapshot proxy
    this.stateValue = this.stateRef.value  // 原始 draft proxy（给 Pu  andlers 用）
  }

  4. React 消费

  无 selector：
  // createUseModel.tsx:42-44
  const view = () => model.$getApi()
  useSyncExternalStore(subscribe, view, view)

  $getApi() 返回 { ...this._currentState, ...this.views }。每次 actio   变了 → $getApi() 返回新对象 → useSyncExternalStore 检测到变化 →re-render。

  有 selector：
  // createUseModel.tsx:68-73
  const mv = model.$createView(selector)
  useSyncExternalStore(subscribe, mv, mv)

  mv 是一个 ModelView，mv() 调用 view.getSnapshot()。view.getSnapshot  value 做 snapshot（model.ts:398-407）。

  5. 结构共享

  _lastDraftToSnapshot 是一个持久化 Map，跨 action 传递：

  const draftToSnapshot = new Map(this._lastDraftToSnapshot)  // 浅拷
  this._lastDraftToSnapshot = draftToSnapshot
  return snapshot(value, draft, this._lastDraftToSnapshot)

  takeSnapshotFromDraft 中 snapshots_.delete(state.proxy) 只清除 modi  。unmodified states 保留上次的 snapshot proxy → React 读到同一个引用 → === 成立 → 不 re-render。

  6. Snapshot 的预期行为

  ┌──────────────────┬─────────────────────────────────────────────────────────┐
  │       属性       │                          预期
  ├──────────────────┼─────────────────────────────────────────────────────────┤
  │ 时间点快照       │ action 完成时的状态冻结，后续 action 不影响旧
  ├──────────────────┼─────────────────────────────────────────────────────────┤
  │ 不含 draft proxy │ 所有属性读出来都是 plain value 或 snapshot pro
  ├──────────────────┼─────────────────────────────────────────────────────────┤
  │ 结构共享         │ 未修改的子树返回同一个 snapshot proxy 引用（跨
  ├──────────────────┼─────────────────────────────────────────────────────────┤
  │ 隔离性           │ stealAndReset 把 copy 从活跃 draft 剥离
  └──────────────────┴─────────────────────────────────────────────────────────┘

7. 临界问题
root B 的 draft 直接 assign 给 root A 的属性 a 上，root A snapshot后，rootA.a 是plain object还是snapshot proxy,背后引用到root b 的draft
