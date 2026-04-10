跑 benchmark/suite/set，通过分析代码， profile 等工具调试 doura 性能瓶颈，优化到分数和 mutative 持平或超出，达成目标时输出 <promise>DONE</promise>

跑suite:
1. build
`pnpm build doura --types`
2. run
`NODE_ENV=production ts-node benchmark/suite/$benchmark-name.ts`

rules:
- 不要只猜测，要验证结论，验证结论时要用控制变量法，交叉检查

注意：
- 需要时去分析 immer 和 mutaive 的源码，对比他们的实现，他们的源码在 doura 的同级目录
- 不能针对benchemark的场景做作弊式的针对优化，损坏其他场景性能，要保持doura功能完整，识别出瓶颈，分析imemr和mutative有没有这样的问题，如果有，它们是怎么解决的
- 只做性能优化，不能造成任何 test 失败，不可以在功能层面修改现有的 test, 如果有情况需要改test，通过 AskUserQuesiton 请求approve
- 确保 benchmark:suite:array，array-batch, object, object-batch 的性能没有回退
- 每次只做一个修改，确认修改带来的提升价值高于代码可读性，维护性的损失时才采纳，采纳后立即提交表代码，并记录到 docs/performance-optimization/object.md，针对改动点，列出改动前后的代码对比，说明为什么改，以及为什么这样行得通且不会破坏原有的逻辑。
