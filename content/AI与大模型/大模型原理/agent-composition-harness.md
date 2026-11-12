---
id: agent-composition-harness
type: 概念题
difficulty: medium
tags: [Agent, Harness, 大模型, 运行底座]
sources: [doubao]
date: 2026-11-12
---

## 题目
什么是 Agent？它由哪些部分组成，各部分的职责是什么？

## 回答
Agent 由「大模型」和「Harness 运行底座」两部分组成：

- **大模型**：负责核心推理，是 Agent 的「大脑」。
- **Harness 运行底座**：负责把工具调用、会话记忆、可观测等能力串起来，让大模型能完成多步骤的真实任务，而不是只做单轮问答。

一个稳定、能落地的 Agent，需要：大模型 + 工具调用 + 上下文/会话记忆 + 可观测能力，才能形成「观察 → 思考 → 行动」的循环。

**面试口语版（简洁无错误点）**：Agent 由大模型和 Harness 运行底座组成，大模型做核心推理，Harness 集成工具调用、会话记忆、可观测这些能力，让单个模型能自动完成复杂任务。
