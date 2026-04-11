draft.ts/
 snapshot slow path 性能优化，先写benchmark，再优化

嵌套在非 draft 对象中的 draft proxy 泄漏
- snaphost 遍历时无法解决路径中包含普通对象的情况，如果要支持，每次都会全量遍历所有对象，性能可能会非常糟糕
