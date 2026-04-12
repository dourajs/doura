All orphan cases show { a: 1 } instead of { a: 2 }. The orphan's modification is lost. The issue: resolveValue for a draft proxy returns clones.get(state) || state.base. The orphan is NOT in clones (not found by BFS). state.base = original { a: 1 } (not stolen). But state.copy = { a: 2 }.
The fix: resolveValue for draft proxies should check clones.get(state) || state.copy || state.base:
- bsf找不到orpha draft，但是assignedMap + handleValue 可以找到呀，为什么不在这里处理
