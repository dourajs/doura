## Tracking parent-child relation-ship
当前p arent-child 关系在创建时绑定，一个child只能有一个parent，不会变更。后续如果 move draft 造成了 parent-child 关系失效，不做特殊处理。
当前行为潜在的问题:
- 见 test "Known limitation: stale view snapshot after moving a draft"

## Draft nested in plain objeect
### Orpha draft
当作 plain object, 确保 snapshot 不泄漏 draft proxy

### Multi-reference Draft
snapshot 需要确保不泄漏，snaphost 后的值是否还如同draft中一样保持同一份引用？
same-root: 同一份引用，同步更新
cross-root: 不同引用，赋值后会被快照

### Cross-root orpha Draft (foreign draft)
同 Orpha draft 一致
