---
id: why-temporal-durable-execution
type: 概念题
difficulty: hard
tags: [Temporal, 持久执行, 分布式]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
关于temporal 我有个疑问 既然现在代码 90% 可能都是用ai写的（codex/claude code） 那么 temporal无非就是 一些重试 故障处理 等高可用性的功能 自己也可以实现 为什么需要temporal 是因为他有ui界面 然后可以让我们专注业务/流程本身 而不需要关注健壮性的问题吗 还有用在ai/agent的项目 实际是一种场景 任何项目中都可以用 对吗

## 回答
你的理解方向基本正确，但少了一层关键区别：

Temporal 不是“把重试、故障处理封装起来，再附送一个 UI”，而是一个持久化执行系统（Durable Execution Platform）。
它解决的核心问题是：一个跨进程、跨服务、可能持续数小时甚至数月的业务流程，在任意节点崩溃后，能够从正确的逻辑位置继续执行。

官方将它描述为：应用代码即使遭遇进程崩溃、网络故障或基础设施中断，Workflow 仍能恢复并继续执行；其基础是持久化的 Event History 和确定性重放。
Temporal Docs
+2

一、AI 能写代码，不等于不需要 Temporal
