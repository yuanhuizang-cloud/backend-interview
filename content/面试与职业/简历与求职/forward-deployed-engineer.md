---
id: forward-deployed-engineer
type: 概念题
difficulty: easy
tags: [FDE, 岗位]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
Forward Deployed Engineer 是什么 可以干什么 什么意思 招聘要求是什么 需要具备什么能力

## 回答
Forward Deployed Engineer，简称 FDE，中文没有特别统一的翻译，常见理解是：

前线部署工程师 / 客户现场工程师 / 面向客户的一线工程师。

但这个中文很容易让人误以为是“实施工程师”。实际上现在 AI 公司里的 FDE，通常比传统实施岗技术含量高很多。

最核心的一句话是：

FDE = 能直接进入客户真实业务现场，自己发现问题、设计方案、写代码、集成系统、上线生产，并把客户现场经验反哺产品的高级工程师。

OpenAI 对自己的 FDE 定义也很接近这个意思：FDE 和战略客户一起，把前沿模型真正部署成生产系统，负责从 discovery、technical scoping、system design，到 build 和 production rollout 的完整过程。
OpenAI
+1

1. 为什么会出现 FDE 这个岗位？

传统软件公司通常是这样的：

纯文本
销售
 ↓
售前 / Solution Architect
 ↓
产品经理
 ↓
研发
 ↓
实施
 ↓
客户

每个人只负责一段。

但是 AI 产品现在有一个很大的问题：

很多客户自己也不知道 AI 到底该怎么嵌入业务。

客户可能只会说：

“我们想用 AI 提高法务效率。”

或者：

“我们有很多客服，希望 Agent 自动处理。”

或者：

“我们 Kubernetes 故障很多，希望 AI 自动排障。”

这不是一个清晰的需求。

所以需要一个人直接进去：

纯文本
客户真实业务
     ↓
发现高价值问题
     ↓
定义技术方案
     ↓
快速 PoC
     ↓
写代码
     ↓
接企业系统
     ↓
Eval
     ↓
上线
     ↓
观察使用情况
     ↓
迭代

这个人就是 FDE。

因此名字里的：

Forward Deployed

本质上来自一种“把工程能力部署到最前线”的思想。

不是坐在总部等 PRD。

而是：

工程师直接前置到客户环境解决问题。

2. FDE 每天到底做什么？

假设你现在是一个 AI FDE。

某大型企业找到
