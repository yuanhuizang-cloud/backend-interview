---
id: kafka-vs-rocketmq
type: 概念题
difficulty: medium
tags: [Kafka, RocketMQ]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
kafka和rocketmq对比

## 回答
资深后端模拟面试｜2026 年 10 月 30 日

本周主题：Agent 长任务恢复、Lease、Fencing Token 与业务幂等

本周完成了三项工作：核对 9 月 7 日版简历、抽样近期五城市社招岗位及公开面经，并编写运行了一套 Go 故障注入实验。

本周最值得训练的问题是：一个 AI Agent 任务执行到一半，Worker 崩溃并发生重复调度，如何保证任务可恢复、旧 Worker 不覆盖新结果、外部操作不重复执行？

这道题同时考察高级后端的分布式一致性能力，以及 AI Backend 的 Agent Runtime 工程能力。

一、本周招聘市场校准

检索范围：2026 年 4—10 月。北京优先，同时覆盖上海、深圳、广州、杭州。

城市	社招岗位样本	发布或核验日期	匹配判断
北京、上海	百度 Dumate-Agent 后端研发	9 月 20 日，官方	高：Go/Python、Kafka、K8s、Agent 状态持久化
北京、上海	百度云原生 Agent Infra 高级研发	7 月 21 日，官方	中高：云原生、调度、沙箱、可观测
北京、上海、深圳	腾讯混元 Agent 评测 Infra	10 月 28 日，第三方更新	高：任务调度、并发控制、评测运行环境
上海、深圳、北京、杭州	腾讯 Agent Harness 工程师	10 月 20 日，第三方记录	挑战型：Agent Loop、Checkpoint、Tool Runtime
广州	字节抖音 AI Agent 开发	8 月 3 日，第三方收录	中：Go/Python、RAG、LangGraph、MCP
杭州	阿里云 Agent Infra 研发	10 月 29 日，第三方称官网核验	中高：AI Gateway、Agent 平台、中间件
杭州	阿里云 Agent 应用开发	10 月 29 日，第三方称官网核验	中高：业务系统、Tool Calling、稳定性

北京前两项为官方 JD；其余岗位的具体要求来自第三方职位记录，未逐一确认实时申请状态。不能把第三方页面的更新日期直接当成企业新发布岗位的日期。

本周值得注意的新岗位

的 Agent 评测 Infra 岗位明确要求：Python/Go/Java、分布式任务调度、沙箱环境、并发控制、结果可复现与故障诊断。其职责更偏评测基础设施工程，而非模型算法研究。
CareerPlan

这类岗位与你已有的分布式系统、性能治理和 Go 工程经验存在较好的迁移空间。

但还需要补齐实际证据：任务恢复、并发调度、评测运行环境和安全隔离，不能只停留在架构图。

二、JD × 面经交叉分析

本周参考了 9 月 23—24 日的后端/Agent 面经，以及 10 月 12 日的 Agent 技术面试记录。

公开问题涉及 MCP 工具接口、Agent 状态、Context、循环终止、项目评审指标，以及 Redis 热 Key、限流和并发控制。
牛客网
+1

技术主题	JD 支持	面经支持	本周优先级
Go、Redis、Kafka、稳定性	强	多个公开样本	P0
Agent 状态与任务恢复	强	有相关问题	P0
Tool Calling、MCP、权限	强	多个公开样本	P0
Agent Eval、可观测	强	有相关问题	P1
RAG、LangGraph	强	有相关问题	P1
CUDA、GPU Kernel 优化	特定岗位强	本轮不足	P2

这里的频次仅表示本次抽样中出现的情况，不代表整个社招市场的统计频率。匿名面经也不能作为某家公司固定题库的证据。

三、本周正式模拟面试
Q1：AI Code Review 长任务故障恢复

假设你负责公司内部的 AI Code Review 系统。

系统已经能够接收 GitLab MR 事件，异步执行代码分析。

目前架构如下：

纯文本
GitLab Webhook
       │
       ▼
    API Server
       │
       ▼
     Kafka
       │
       ▼
    Worker Pool
       │
       ▼
    LLM Review
       │
       ▼
   GitLab Comment

某个 MR 的 Review 任务执行时间约为 2—8 分钟。

现在发生故障：

纯文本
10:00:00  Worker A 获取任务 Task-1001

10:00:10  Worker A 开始调用 LLM

10:02:00  LLM 返回 Review 结果

10:02:01  Worker A 发生网络异常

10:02:30  系统认为 Worker A 已失联

10:02:31  Worker B 重新获取 Task-1001

10:02:35  Worker A 网络恢复

此时：
Worker A 和 Worker B
都认为自己可以继续执行任务
面试官提问

你作为系统 Owner，如何设计这套任务执行机制，保证任务能够恢复，同时避免重复执行和错误覆盖？

重点考察五个方面：

如何定义任务状态机，以及合法的状态转换。
如何判断 Worker 已失联，允许其他 Worker 接管。
如何防止旧 Worker 恢复后覆盖新 Worker 的执行结果。
如何处理已经成功发布 GitLab Comment、但任务状态尚未更新时的崩溃。
如何设计重试上限、超时、并发控制、监控与人工介入。

作答时间：5 分钟。

本轮先独立口述，不提前展示参考答案。

后续将围绕 Fencing Token、外部副作用幂等、Lease 续租、Kafka 重投和多租户过载进行连续追问。

四、本周工程产物：已完成并通过测试
Go Agent Lease / Fencing / Checkpoint 实验

下载完整 Go 实验、测试日志与面试题卡

本次实际编写并运行了一个独立 Go 教学实验。

项目包含：

纯文本
agent_lease_lab_20261030/
├── go.mod
├── task.go
├── task_test.go
├── README.md
├── interview_card.md
├── market_notes.md
├── test_output.txt
└── race_output.txt
实际验证结果
故障场景	测试结果
Worker 崩溃后任务重新认领	PASS
旧 Worker 恢复后提交过期结果	PASS：被拒绝
Lease 到期后旧 Worker 继续提交	PASS：被拒绝
重试次数耗尽进入 FAILED	PASS
40 个 goroutine 同时竞争任务	PASS：只有一个获得 Lease
go test -race ./...	PASS

测试使用 Go 1.23.2，在本地环境完成。

证据边界： 这是内存状态机实验，不是真实 Kafka、数据库或 GitLab 集成测试，也没有验证跨进程持久化。它证明了模型中若干状态不变量，但不能据此宣称实现了生产级 exactly-once。

15—30 分钟最小练习

运行：

Bash
go test -v ./...
go test -race ./...

然后只研究一个测试：

TestCrashRecoveryAndStaleWorkerFencing

重点理解：

纯文本
Worker A 获取 Lease
       ↓
写入 Checkpoint
       ↓
Lease 过期
       ↓
Worker B 接管
       ↓
Fencing Token 递增
       ↓
Worker A 恢复
       ↓
旧 Token 写入被拒绝
       ↓
Worker B 完成任务

真正需要掌握的不是 API 名称，而是：

Lease 解决执行权的时效性问题，Fencing Token 解决过期执行者继续写入的问题；两者仍不能自动保证外部工具调用恰好一次。

五、简历与作品集边界

本次已经定位并查看了准确文件《简历.pdf》，共两页。

该版本明确区分了某设计平台 Python→Go 生产重构、某协同产品 文件协同治理，以及 AI 研发效能的场景调研和 Demo。
简历

因此，本周实验的正确定位是：

独立工程实验：Agent 异步任务恢复与并发安全。

不能写成：

“主导公司生产级 Agent Runtime 建设，保障海量任务稳定执行。”

目前可以用于作品集的表述是：

“基于 Go 实现 Agent 异步任务状态机原型，通过 Lease、Fencing Token 和条件写入模拟 Worker 故障恢复，完成并发竞争、过期写入及重试耗尽等故障注入测试。”

这是已经有代码和测试支持的表述。

六、本周训练状态
能力	状态	验收标准
Go heap / allocs	基本掌握	变式复测
线上故障止损决策	待复测	5 分钟形成完整证据链
Kafka 业务一致性	待复测	解释重投与版本恢复
AI Review Eval	教学实验已交付	独立解释指标和上线门禁
Agent Lease / Fencing	本周重点	独立解释故障时序
Agent 外部操作幂等	待验证	能解释重复评论风险
RAG / LangGraph	待补齐	最小工程闭环

本周尚无新的口述回答，因此五维评分、追问命中率、限时完成度及重复错误次数均保持待测。

技术资料
资料	推荐理由	投入	最小起步
Temporal Workflow Execution	理解持久执行、事件历史与故障恢复	10 分钟	重点理解 Replay
LangGraph Persistence	区分 Checkpoint 与长期 Memory	10 分钟	关注 Checkpointer 和 Store
PostgreSQL UPDATE	理解条件更新和状态竞争	10 分钟	研究 WHERE 与 RETURNING

核心内容已对应到实验，不需要先完整阅读文档。

七、下阶段安排

下一个四周节点将重新评估北京、上海、深圳、广州、杭州的三类岗位匹配度：Senior Backend、AI Backend 和 AI Infrastructure。

技术训练继续围绕真实简历和可验证项目展开。

本周的核心能力目标：能够独立解释为什么 Agent 任务不能只靠 Kafka 重投和普通分布式锁恢复，以及如何用状态机、Lease、Fencing 和业务幂等控制故障风险。

这项能力可以直接迁移到 AI Code Review、自动化测试 Agent、异步工作流和 Agent Runtime 岗位。

星期五 9:49
资深后端模拟面试
