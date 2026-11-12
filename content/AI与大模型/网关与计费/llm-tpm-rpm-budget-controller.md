---
id: llm-tpm-rpm-budget-controller
type: 手撕代码
difficulty: hard
tags: [限流, TPM, RPM, 多租户]
sources: [gemini]
date: 2026-11-12
---

## 题目
请用 Go 语言展示一个大模型网关中针对多租户进行 TPM/RPM 限流与动态预算控制 (Budget Controller) 的核心代码实现。

## 回答
在 AI Agent Infra（智能体基础设施平台，如 OpenClaw、Dify、LangChain Platform 等）的面试中，当面试官问到“如何做资源隔离”时，他考察的不仅仅是传统的 K8s/容器隔离，而是AI Agent 场景下特有的多租户（Multi-tenancy）安全、算力成本、执行环境与 API 配额管控。

因为 Agent 与传统 Web 应用不同，它具备代码执行（Code Interpreter）、工具调用（Tools/Bash）、长时间运行（Long-running tasks）以及大模型 Token 消费等特性，一旦没有做资源隔离，极易导致：

安全风险：恶意 Agent 通过 Bash 工具执行任意代码，逃逸并攻击宿主机。

算力与成本暴涨：某个租户的 死循环 Agent 刷爆大模型 API，导致其他租户欠费或平台被上游限流。

噪音邻居效应（Noisy Neighbor）：某个 Agent 大量消耗 CPU/内存/网络，导致同节点其他 Agent 响应变慢。

以下是结构化的回答套路以及工业界的通用做法：

一、 面试回答的“黄金四层隔离”框架

回答时，建议按照“计算/代码执行隔离 
→
→ 大模型/API 资源隔离 
→
→ 网络与数据隔离 
→
→ 业务与多租户隔离”这 4 个层级递进展开，展现你的系统深度与实战经验。

┌────────────────────────────────────────────────────────┐
| 1. 计算与代码执行隔离 (Compute & Sandboxing)           |
|    - gVisor / Firecracker 微虚拟机 / Docker 无权容器    |
├────────────────────────────────────────────────────────┤
| 2. 大模型 API 与 Token 资源隔离 (LLM & Quota Limits)   |
|    - Rate Limiting / Token Bucket / 预算上限 (Budget)  |
├────────────────────────────────────────────────────────┤
| 3. 网络与数据隔离 (Network & Multi-Tenant Data)         |
|    - VPC / K8s NetworkPolicy / 矢量数据库租户隔离     |
├────────────────────────────────────────────────────────┤
| 4. 运行时与上下文隔离 (Runtime & Context Safety)        |
|    - Agent 内存/会话隔离 / 单次 ReAct 循环超时控制     |
└────────────────────────────────────────────────────────┘

二、 一般可以怎么做？（工业界主流落地方案）
1. 计算与代码执行隔离（最关键、最硬核的安全隔离）

当 Agent 拥有 Python Code Execution、Bash 或 Terminal Tool 时，必须防范恶意代码。

轻量级沙箱（Sandbox）： 绝对不能直接在宿主机或普通 Docker 容器里运行用户 Agent 代码。

方案 A（微虚拟机 Firecracker / Kata Containers）： 类似于 AWS Lambda 的实现，为每个 Agent/租户启动一个毫秒级启动的超轻量 VM，实现硬件级别的 Kernel 隔离。

方案 B（用户态安全容器 gVisor）： Google 开源的沙箱，在用户态拦截和重构 Syscall（系统调用），防止容器逃逸。

方案 C（无痕临时容器 E2B / Fly.io）： 采用专门的 Agent Sandbox 服务（如 E2B），每个代码执行任务都在短生命周期（Ephemeral）的无无权沙箱里运行，用完即毁。

K8s 资源限制（Cgroups & Namespace）： 对 Agent 容器设置严格的 limits.cpu、limits.memory，防止 OOM 影响其他 Pod。

2. 大模型 API 与配额隔离（LLM Gateway 层面的成本与速率控制）

Agent 在运行过程中可能陷入死循环（不停调用 LLM），必须在 AI Gateway（如 LiteLLM、OpenClaw Gateway）进行管控：

Rate Limiting（限流）： 基于令牌桶（Token Bucket）算法，对每个租户/Agent 限制 RPM（Requests Per Minute）和 TPM（Tokens Per Minute）。

Budget & Cost Hard Limit（预算硬上限）： 为每个租户设置每日/每月消费上限（例如每个租户每天最多消费 $10 美元）。一旦达到上限，网关直接拦截请求并抛出 QuotaExceeded 错误。

并发数隔离（Concurrency Limit）： 限制单一租户同时运行的 Agent 实例或并发 LLM 请求数，防止某个租户占用网关全部连接池。

3. 网络与数据隔离（防止越权与数据泄露）

网络隔离（Network Policy）：

执行代码的 Agent 沙箱默认断网（No External Network Access），或者仅允许通过白名单访问特定的 API/MCP Server。

使用 K8s NetworkPolicy 阻止 Agent 容器访问集群内部的 Sensitive IP（如 K8s API Server、数据库集群）。

数据与向量检索隔离（Vector DB & Storage）：

逻辑隔离（Metadata Filtering）： 多个租户共享一个 Vector DB（如 Qdrant/Pinecone），但在查询和写入时强制携带 tenant_id 过滤条件。

物理隔离： 对安全性要求极高的企业客户，在向量数据库与关系型数据库层为不同租户分配独立的 Schema 或 Database 实例。

4. Agent 运行时与上下文隔离（Runtime Safety）

ReAct 步骤与超时限制（Max Steps & Timeout）： 限制单个 Agent 执行任务的最大轮次（如 max_iterations=15）以及整体超时时间（如单次任务最长 3 分钟），防止 Agent 陷入无休止的自我修正循环。

Tool 权限隔离（RBAC for Tools）： 不同级别的 Agent/用户拥有的工具调用权限不同（如普通用户 Agent 只能读文件，管理员 Agent 才可以写文件或调外部 API）。

三、 面试时的得分话术示范

在面试中回答该问题时，可以直接套用以下回答表达：

“在 Agent Infra 平台中，资源隔离是一个多维度的问题，因为 Agent 不仅有传统的计算资源开销，还有代码执行安全以及大模型 Token 消费的特殊性。我们在设计时主要从四个层面做隔离：

第一，最核心的是代码执行与沙箱隔离（Code Sandbox）：
Agent 经常需要调用 Python 或 Bash 工具。为了防止容器逃逸和恶意代码，我们绝对不直接在宿主机或共享容器里运行用户代码。工程上我们会采用 gVisor 或短生命周期的轻量沙箱（如 E2B / Firecracker），配合 K8s 的 Cgroups（限制 CPU/内存）和 Namespace 进行严格的系统调用与硬件级隔离，用完即毁。

第二，是大模型 API 与 Token 资源的配额隔离（LLM Gateway）：
Agent 容易因为 Prompt 诱导或逻辑缺陷陷入死循环。我们在大模型网关层实现了多租户限流与配额管控：针对每个 tenant_id 设置 TPM（Token 每分钟） 和 RPM 限制，同时配置每日预算 Hard Limit。一旦某个 Agent 消费异常触发阈值，网关直接切断请求，避免把平台或上游 API 刷爆。

第三，是网络与数据的安全隔离：
沙箱容器在网络上采取最小权限原则，通过 K8s NetworkPolicy 禁用内网访问，仅开放必要的出站白名单。在向量数据库和 RAG 存储层面，采用带 tenant_id 元数据过滤的逻辑隔离，确保租户间知识库绝对无法越权访问。

第四，是 Agent 运行时的步骤与超时控制：
在 Agent Harness 执行引擎层，设置强制的 max_iterations（最大 ReAct 轮次）和单次 Task 超时机制，防止无意义的 CPU 与内存消耗。

通过这套组合拳，我们既保证了平台多租户下的稳定性与成本可控，又杜绝了 Agent 代码执行的安全隐患。”
