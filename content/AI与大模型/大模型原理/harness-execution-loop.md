---
id: harness-execution-loop
type: 概念题
difficulty: medium
tags: [Harness, Agent, 执行循环, ReAct]
sources: [doubao]
date: 2026-11-12
---

## 题目
Harness 运行底座的核心能力（Agent 执行循环）是什么？

## 回答
Harness 最核心的能力是内置了标准的 **Agent 执行循环**（观察-思考-行动的 OODA / ReAct 式循环）：

1. 自动调度大模型输出思考结果；
2. 调用工具获取外部信息；
3. 更新会话记忆；
4. 把结果喂回模型，一轮轮执行直到任务完成。

开发者无需手写这个流转逻辑，这是它作为运行底座的关键价值。

**注意一个易错点**：运行框架是 Harness（不是大模型），大模型只负责核心推理，Harness 负责调度和执行循环。
