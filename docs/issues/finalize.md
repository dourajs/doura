# Eager Finalization: 已知问题与重构方案

## 背景

Doura 的 `snapshot()` 有两条路径：
- **Slow path**（model 系统）：`takeSnapshotFromDraft` + `createSnapshotProxy` — 返回 snapshot Proxy，通过 `toSnapshot()` 惰性解析 draft refs
- **Fast path**（standalone `draft()/snapshot()` 模式）：`finalizeDraft` — 直接返回 plain object，需要主动解析 copy 中的 draft proxy refs

Fast path 入口条件：`!snapshots && isDraft(value) && value === draft`

本文档记录 fast path (`finalizeDraft`) 中已发现的三类正确性问题，以及 Mutative 的解决方案。

---

## 问题 1：Rename（move + delete）

### 场景

```ts
produce({ obj: {} }, (s) => {
  s.foo = s.obj   // child draft proxy 被赋值到新 key
  delete s.obj    // 原始 key 被删除
})
```

### 影响范围

Object、Array、Map 都有此问题。

### 当前处理

`resolveDraftRefs` 中用 `child.key` 做 O(1) 定位。set trap 中更新 `child.key = newProp`，所以 rename 后 key 指向新位置。配合 `needsScan` fallback 处理多引用情况。

### 问题

当前实现可以工作，但 `needsScan` fallback 是 O(n) 全量扫描 copy 的所有属性。对于大对象性能不佳。

### 测试覆盖

- `can rename nested objects (no changes)` — Object rename + isDraft check
- `can rename nested objects (with changes)` — Object rename with modifications + isDraft check
- `can move array element to a different index` — Array move + isDraft check
- `Map: moved draft (delete + set to new key)` — Map rename + isDraft check

---

## 问题 2：多引用（同一 draft proxy 出现在多个 key）

### 场景

```ts
produce({ a: { b: 1 } }, (d) => {
  d.a.b++
  d.b = d.a   // 不 delete d.a，两个 key 指向同一个 draft proxy
})
```

### 影响范围

Object、Array、Map 都有此问题。

### 当前处理

`child.key` 只能存一个值（最后赋值的 key）。key-based resolution 只解析一个位置，另一个位置靠 `needsScan` fallback 扫描。

### 测试覆盖

- `supports multiple references to any modified draft` — Object + isDraft check
- `supports multiple references to any modified draft (array)` — Array + isDraft check
- `Map: multiple references to same draft (needsScan fallback)` — Map + isDraft check

---

## 问题 3：嵌套在非 draft 对象中的 draft proxy 泄漏

### 场景

```ts
produce({ obj: { a: 1 } }, (s) => {
  s.obj.a = 2
  s.foo = { bar: s.obj }   // draft proxy 嵌套在新创建的 plain object 中
  delete s.obj
})
```

`{ bar: s.obj }` 是一个新创建的 plain object，不是 draft。它内部的 `bar` 属性指向一个 draft proxy。`resolveDraftRefs` 只扫描 copy 的直接属性，不递归进入非 draft 容器，所以嵌套的 draft proxy 泄漏到结果中。

### 影响范围

可能嵌套在 plain object、Array、Map value 中。任何用户创建的容器对象都可能包含 draft proxy。

### 泄漏的后果

1. **可变性泄漏** — draft proxy 的 set trap 仍然活跃，用户可意外修改内部 draft state
2. **内存泄漏** — draft proxy 持有整棵 DraftState 树（root/parent/children/copy），阻止 GC
3. **结构共享失效** — 每次 produce 创建新 draft proxy，引用比较永远不等

### 额外复杂性：孤儿 draft

```ts
produce({ obj: { a: 1 } }, (s) => {
  s.obj.a = 2
  s.foo = { bar: s.obj }
  delete s.obj    // removeChildRef 将 objChild 从 children 移除
})
```

`delete s.obj` 调用 `removeChildRef`，将 objChild 从 root 的 children 数组中移除。`finalizeDraft` 的 BFS 遍历 children 树时找不到 objChild → `stealAndReset` 不会被调用 → objChild.base 仍是旧值（`{ a: 1 }`），而非 modified copy（`{ a: 2 }`）。

### 当前处理

当前实现使用了多个补丁机制：
- `hasDraftableAssignment` flag — 在 set trap 中设置，标记"有 draftable 非 draft 赋值"
- `childBases` 过滤 — 跳过已解析的 child base 值
- `finalizeDraftValue` — 处理孤儿 draft（被 delete 后不在 modified 列表中）
- `getOwnPropertyDescriptor` — 避免触发 getter 副作用
- `handleValue` — 递归扫描 draftable 对象中的 draft proxy

### 测试覆盖

- `can nest a draft in a new object` — 基础嵌套 + isDraft check
- `can nest a modified draft in a new object` — 修改后嵌套 + isDraft check
- `can nest a draft deeply in new plain objects` — 深层嵌套
- `should not leak drafts when assigning draft into an array in a new object` — Array 容器
- `Map: draft nested in new plain object assigned via set()` — Map 容器
- `Set: add() with a draft proxy should not leak it into result` — Set add
- `no recursive scan needed when no drafts are nested in plain objects` — 提前终止验证
- `should not visit objects which aren't modified` — getter 安全性验证

---

## 当前实现的根因分析

以上三个问题的补丁机制（needsScan、hasDraftableAssignment、childBases、finalizeDraftValue、getOwnPropertyDescriptor）都源自同一个根因：

**`finalizeDraft` 采用 tree-walk（BFS 遍历 children 树）来发现和解析 draft proxy，这依赖 children 数组的完整性。delete 会破坏树结构（removeChildRef），导致 BFS 找不到孤儿 draft。同时 tree-walk 只处理 copy 的直接子属性，不覆盖嵌套在非 draft 容器中的 proxy。**

---

## Mutative 的解决方案

Mutative 用两个机制彻底解决了上述所有问题。

### 机制 1：Flat Finalization Callback

**核心思想**：每个 child draft 在创建时向一个 flat 数组注册 finalization callback。callback 不随 delete 移除。finalization 时 pop 所有 callback 执行。

**注册时机**：`createDraft()` 中，child draft 创建后立即 push callback。

**callback 逻辑**（`mutative/src/draft.ts` createDraft ~line 260）：
```ts
target.finalities.draft.push((patches, inversePatches) => {
  // 读取 parent copy 中原始 key 处的当前值
  const draft = get(copy, key!);
  const proxyDraft = getProxyDraft(draft);
  if (proxyDraft) {
    // 如果仍然是 draft proxy，替换为 finalized value
    let updatedValue = proxyDraft.operated
      ? getValue(draft)       // modified → use copy
      : proxyDraft.original;  // unmodified → use original
    finalizeSetValue(proxyDraft);  // Set 特殊处理
    set(copy, key!, updatedValue);
  }
  // 如果 key 处已不是 draft（被 delete 或替换），callback 什么都不做
});
```

**finalization 执行**（`mutative/src/draft.ts` finalizeDraft ~line 300）：
```ts
while (proxyDraft.finalities.draft.length > 0) {
  const finalize = proxyDraft.finalities.draft.pop()!;
  finalize(patches, inversePatches);
}
```

LIFO 顺序确保 leaf child 先于 parent 处理。

**为什么解决了孤儿问题**：callback 注册在 flat 数组中，不依赖 children 树结构。delete 只修改 children 数组，不影响 finalities 数组。所有创建过的 child draft 都有 callback，无论后续是否被 delete。

**为什么解决了 rename 问题**：callback 检查 `get(copy, key!) === draftProxy`。如果 draft 已被移走，条件不成立，callback 跳过。被移走的 draft 由 assignedMap 机制处理。

### 机制 2：assignedMap + finalizeAssigned + handleValue

**核心思想**：追踪哪些 key 被用户显式赋值，finalization 时只对这些 key 的 value 做递归扫描。

**assignedMap 追踪**（`mutative/src/draft.ts` set trap ~line 166-172）：
```ts
// set trap
ensureShallowCopy(target);
markChanged(target);
if (has(target.original, key) && isEqual(value, target.original[key])) {
  target.assignedMap!.delete(key);  // 赋回原值，取消标记
} else {
  target.assignedMap!.set(key, true);  // 标记为已赋值
}
target.copy![key] = value;
```

delete trap 中设置 `assignedMap.set(key, false)`。

**finalizeAssigned**（`mutative/src/utils/finalize.ts` ~line 55）：
```ts
export function finalizeAssigned(proxyDraft, key) {
  const copy = proxyDraft.type === DraftType.Set
    ? proxyDraft.setMap
    : proxyDraft.copy;
  if (
    proxyDraft.finalities.revoke.length > 1 &&
    proxyDraft.assignedMap!.get(key) &&
    copy
  ) {
    handleValue(
      get(copy, key),
      proxyDraft.finalities.handledSet,
      proxyDraft.options
    );
  }
}
```

只在 `assignedMap.get(key) === true`（用户赋值了）时调用 `handleValue`。

**handleValue**（`mutative/src/utils/finalize.ts` ~line 15）：
```ts
export function handleValue(target, handledSet, options) {
  if (isDraft(target) || !isDraftable(target, options)
      || handledSet.has(target) || Object.isFrozen(target))
    return;
  handledSet.add(target);
  forEach(target, (key, value) => {
    if (isDraft(value)) {
      const proxyDraft = getProxyDraft(value)!;
      ensureShallowCopy(proxyDraft);
      const updatedValue = proxyDraft.assignedMap?.size || proxyDraft.operated
        ? proxyDraft.copy
        : proxyDraft.original;
      set(target, key, updatedValue);
    } else {
      handleValue(value, handledSet, options);  // 递归
    }
  });
}
```

**为什么解决了嵌套泄漏**：当用户执行 `draft.foo = { bar: draft.obj }` 时，`assignedMap.set('foo', true)`。finalization 时 `finalizeAssigned(state, 'foo')` 调用 `handleValue(copy['foo'], ...)`，递归进入 `{ bar: draftProxy }` 并替换嵌套的 draft proxy。

**为什么不需要 hasDraftableAssignment**：`assignedMap` 精确记录了哪些 key 被赋值。只处理那些 key，不会进入未赋值的属性（如原始 base 中的 getter 对象）。

**为什么不需要 childBases 过滤**：`finalizeAssigned` 只处理 `assignedMap.get(key) === true` 的 key。未赋值的 key 不会被扫描。

**为什么不需要 finalizeDraftValue**：flat callback 覆盖了所有创建过的 child draft（包括孤儿）。`handleValue` 中发现的 draft proxy 直接读 `proxyDraft.copy ?? proxyDraft.original`，不需要显式 steal。

**为什么不需要 getOwnPropertyDescriptor**：不会进入未赋值的属性，所以不会触发原始 base 中的 getter。（注：如果用户赋值的新对象本身有 getter，Mutative 也会触发——这是已知限制。）

### 两个机制的协作

```
finalizeDraft:
  1. pop finalities callbacks  →  解析 parent copy 中仍在原始 key 处的 child proxy
  2. 遍历 assignedMap
     → assigned=true 的 key  →  finalizeAssigned  →  handleValue 递归解析嵌套 draft
     → assigned=false 的 key  →  跳过（deleted key）
  3. return root.copy (if operated) or root.original
```

对应三类问题：
- **Rename**：callback 尝试原始 key → 已移走 → 跳过。新 key 通过 assignedMap 触发 handleValue
- **多引用**：callback 解析一个位置。其他位置如果是用户 set 的（在 assignedMap 中），由 handleValue 解析；如果是原始 get 创建的 child，则有自己的 callback
- **嵌套泄漏**：assignedMap 精确定位用户赋值的 key，handleValue 递归扫描其 value

---

## 重构建议

将 `finalizeDraft` 从 tree-walk 模式重构为 Mutative 的 flat callback + assignedMap 模式。

### 需要新增

1. **`finalities` 数组**：挂在 root state 上，所有 child draft 共享。`draft()` 中 child 创建时 push callback。
2. **`assignedMap`**：每个 DraftState 上惰性创建。在 Object/Array set trap、Map set()、Set add() 中 `map.set(key, true)`；在 delete 中 `map.set(key, false)`。
3. **`handleValue`**：递归扫描 draftable 对象，替换嵌套的 draft proxy。用 `handledSet` (Set) 防循环。

### 需要移除

1. `hasDraftableAssignment` flag
2. `childBases` 过滤逻辑
3. `finalizeDraftValue` 函数
4. `getOwnPropertyDescriptor` getter 安全逻辑
5. `resolveDraftRefs` 函数（被 flat callbacks 替代）
6. `needsScan` 分支逻辑

### 需要保留

1. `stealAndReset` — model 系统的 slow path 仍需要
2. `addChildRef`/`removeChildRef`/`children` — model 系统和 `resetDraftChildren` 仍需要
3. `takeSnapshotFromDraft` + `createSnapshotProxy` — slow path 不变

### 关键文件

- `packages/doura/src/reactivity/draft.ts` — DraftStateBase、draft()、finalizeDraft、handleValue
- `packages/doura/src/reactivity/baseHandlers.ts` — get trap（callback 注册）、set trap（assignedMap）、delete trap
- `packages/doura/src/reactivity/collectionHandlers.ts` — Map get/set、Set add/ensureSetValueDrafted

### 验证

不修改任何测试。当前 350 个测试（345 pass + 5 skipped）应全部保持不变。
