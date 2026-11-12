---
id: rocketmq-delay-order-cancel
type: 场景题
difficulty: hard
tags: [RocketMQ, 延迟消息, 订单]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
订单创建 ↓ 30分钟未支付 ↓ 自动取消这种用rocketmq怎么实现 配合代码 示例 消息内容 配置等讲解

## 回答
资深后端模拟面试｜2026 年 11 月 6 日

本周主题：Agent 任务恢复与外部副作用一致性——从原型设计走向生产级工程验证。

本周的训练重点不是增加新框架，而是解决上一期 Agent Lease 实验留下的关键问题：

Worker A 已经成功向 GitLab 发布 Review Comment，但在更新数据库任务状态之前崩溃。Worker B 接管任务后，如何避免重复评论？

这个问题同时考察分布式一致性、任务状态机、幂等、故障恢复和 Agent 工程化能力，非常适合你的 Senior Backend → AI Backend 转型路线。

一、本周招聘市场校准

检索日期：2026 年 11 月 6 日。重点检查近六个月的中国社招岗位，优先北京。

城市	岗位样本	日期及来源	关键要求	匹配判断
北京	字节 AI Agent 架构治理工程师	11 月 4 日更新，第三方	Go、分布式系统、可观测性、MCP、故障治理	高
北京/深圳	腾讯混元后台开发工程师	11 月 5 日收录	大模型平台后台开发；具体技术要求待官方核实	待进一步核实
北京/上海/深圳	腾讯混元 Agent 评测 Infra	11 月 3 日更新	Agent 评测基础设施；详细 JD 待核实	重点关注
北京	AI Agent 工程师（Randstad）	10 月 19 日发布	LangGraph、Agent Runtime、RAG、Memory、Eval	中高
杭州	Longbridge Golang 开发工程师	10 月中旬收录	5 年以上、Go、PG、Redis、MQ、AI 应用集成	高
广州	钛动科技 AI Agent 服务端研发	历史职位，8 月 18 日截止	Go、pprof、分布式、缓存、MQ	技术匹配，职位已过期

上海本周未找到足够可靠的新独立岗位样本，沿用此前已核实的 AI Backend / Agent Infrastructure 岗位方向，不把历史岗位视为当前开放。

本周市场变化

值得关注的是两个方向。

第一，AI Agent 架构治理正在与传统后端稳定性治理融合。

的 Agent 架构治理岗位涉及服务治理、根因分析、可观测性、工具调用与 Agent 评测。它不是单纯的 Prompt Engineering 岗位，而是要求候选人理解复杂分布式系统。
CareerPlan

你的 Python→Go 重构、OOM 治理、K8s、性能优化经验可以转化为竞争优势，但需要补充 Agent 工程实证。

第二，AI Backend 招聘并没有放弃传统后端能力。

杭州 Longbridge 的岗位明确要求 PostgreSQL、Redis、MQ、微服务、高可用及线上故障处理，AI 应用开发属于加分能力。
BeBee

这类岗位比纯模型训练、强化学习或 GPU Kernel 岗位更适合当前投递。

二、JD 与面经交叉判断

本周公开面试资料中，能够核实的样本包括截至 11 月 1 日汇总的字节 Go 面试题报告，以及 8 月更新的阿里 Kafka 面试题库。

前者统计了 58 场 Go 面经，事务、隔离级别、网络与并发基础出现较多；后者包含 Kafka 工作机制、系统设计、方案取舍等问题。
+1

但两份资料都存在限制：样本不一定是资深社招，也不能代表 2026 年 10—11 月的实际提问频率。因此不据此宣称某家公司最近必问 Lease 或 Fencing Token。

结合真实 JD 和简历可转化性，本周优先级为：

技术能力	JD 证据	面经证据	个人项目关联	优先级
分布式一致性、幂等、状态机	强	有支持	MasterGo、Agent	P0
Go 性能与线上故障	强	有支持	Python→Go 重构	P0
Agent Runtime、任务恢复	强	样本有限	AI Review 原型	P0
Agent Eval、安全、Tool Calling	强	样本有限	AI 研发效能项目	P1
RAG、LangGraph	强	有相关样本	实践证据不足	P1

本周选择任务恢复，是基于 JD 要求与真实项目的高度相关性，而不是把单个匿名面经当作高频题。

三、本周正式模拟面试
Q1：Agent 任务执行成功，但外部副作用重复

假设你负责公司内部 AI Code Review 系统。

当前架构：

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
       │
       ▼
  PostgreSQL 更新任务状态

某次执行出现以下时序：

纯文本
10:00:00 Worker A 获取 Task-1001

10:01:00 Worker A 完成 LLM Review

10:01:01 Worker A 成功创建 GitLab Comment

10:01:02 Worker A 崩溃
         PostgreSQL 任务状态仍为 RUNNING

10:01:30 Lease 过期

10:01:31 Worker B 接管 Task-1001

10:01:32 Worker B 发现任务尚未完成
面试官提问

你作为 Owner，如何设计这套系统，保证故障恢复后不会产生重复 Review Comment？

请在五分钟内回答以下问题：

Kafka 重投、Lease 和 Fencing Token 分别能解决什么问题？为什么它们仍然不能直接保证 GitLab Comment 不重复？
PostgreSQL 更新任务状态和 GitLab API 调用之间没有共同事务，你如何处理这个一致性边界？
如果 GitLab Comment 已经创建成功，但 HTTP 响应丢失，你如何判断是否需要重试？
如果 Worker A 恢复，而 Worker B 已经接管，如何避免旧 Worker 继续写入？
如何定义系统的正确性指标，以及上线前需要验证哪些故障场景？

本轮不提前给参考答案。

这不是要求你假装做过生产级 Agent Runtime。回答时可以明确区分：已有原型能力、拟采用的架构方案、需要通过故障注入验证的行为。

五维评分标准
维度	满分	当前
任务状态机与恢复机制	20	待测
幂等与跨系统一致性	20	待测
Lease、Fencing 与并发控制	20	待测
故障验证与可观测性	20	待测
技术取舍与 Owner 表达	20	待测

达到 70 分继续完整模拟；60—69 分针对薄弱点复测；低于 60 分则拆解为两个微技能：任务状态 CAS 和 外部副作用去重。

四、本周工程产物：ADR 设计草案

本周没有重新开发一个 Agent，也没有重复制作内存状态机。

我整理了一份可用于后续代码实现、测试和面试表达的架构决策记录。

文件包含任务身份设计、状态转移约束、Fencing、Outbox、GitLab 评论去重策略，以及最小故障注入方案。

核心设计约束
纯文本
Webhook / Kafka
      │
      ▼
任务去重
      │
      ▼
Worker 获取 Lease
      │
      ▼
LLM Review
      │
      ▼
持久化 Review Result
      │
      ▼
Outbox 记录待发布评论
      │
      ▼
Comment Publisher
      │
      ▼
GitLab API
      │
      ▼
记录发布结果

这里最重要的工程边界是：

Outbox 可以避免数据库内部的任务结果与待发布事件出现不一致，但不能单独保证外部 GitLab API 恰好执行一次。

如果 GitLab API 没有可用的原生幂等键，那么“查询是否存在评论，再创建评论”仍然存在并发竞态。

需要进一步结合稳定的评论标识、单写者策略、外部状态核对及补偿去重处理。

15—30 分钟最小验证

本周建议只验证一个场景：

纯文本
第一次发布评论成功
        ↓
模拟 HTTP 响应丢失
        ↓
任务重新调度
        ↓
再次尝试发布
        ↓
检查是否产生重复评论

验收指标为：

指标	当前结果
重复评论数	待测
重复任务数	待测
恢复耗时 P95	待测
GitLab API 调用次数	待测
旧 Worker 非法写入次数	待测

证据边界： 本周产物是 ADR 草案，尚未完成真实 GitLab API、PostgreSQL 与 Kafka 的集成验证。因此不能将它写成已经生产落地的能力。

五、四周职业能力矩阵更新

本次采用定性匹配，不把岗位匹配度伪装成录用概率。

方向	北京	上海	深圳	广州	杭州
Senior Go/Python Backend	优先投递	可投	可投	选择性投递	可投
AI Backend / Agent Backend	重点突破	可投	重点关注	选择性投递	重点关注
AI Infrastructure	挑战型	挑战型	挑战型	样本不足	选择性投递
当前主要能力差距

Senior Backend： Go Runtime、线上故障决策、复杂一致性场景的结构化表达。

AI Backend： Agent Runtime、Eval、Tool Calling、安全，以及真实项目验证数据。

AI Infrastructure： Kubernetes Controller/Operator、调度系统、推理服务内部机制和规模化运行经验。

结合当前招聘市场，仍建议把 Senior Go Backend + AI Backend 作为主要投递组合。

六、训练记录与资料

目前尚无本周新的口述回答，因此不生成五维分数，也不虚构追问命中率。

历史训练项	当前状态	后续验收
Go heap / allocs	基本掌握	变式复测
高频临时对象优化	待复测	独立提出有效优化
下游超时与级联故障	待复测	完整止损决策链
Kafka 业务一致性	待复测	项目深挖
AI Review Eval	教学实验已交付	真实模型结果
Agent Lease / Fencing	教学实验已交付	解释旧 Worker 写入风险
外部副作用幂等	本周重点	故障注入与口述
RAG / LangGraph	待补齐	最小工程闭环

本周参考资料：

资料	推荐理由	预计投入	最小起步
PostgreSQL UPDATE 文档	理解条件更新和状态竞争	10 分钟	重点理解 WHERE + RETURNING
GitLab Discussions API	理解 MR 评论的创建和查询	10 分钟	关注评论定位与重复发布
Temporal Workflow Execution	理解持久工作流与故障恢复	10 分钟	重点区分 Workflow 与 Activity
LangGraph Persistence	理解 Checkpoint 和状态恢复	10 分钟	关注持久化状态与副作用边界

这些资料对应本周的具体故障场景，不需要脱离实验单独背诵。

本周结论

你的真实后端经验已经覆盖高并发、服务重构、稳定性治理、Kafka 和 Kubernetes。下一阶段最有价值的能力增量，是把这些工程经验迁移到 Agent Runtime、Eval 和 Tool 执行体系，并用可复现的故障实验形成证据。

本周保留一个核心问题作为后续模拟入口：

“内部任务状态可以通过 Fencing 防止旧 Worker 覆盖，但外部 API 已经成功执行后发生崩溃，如何保证恢复过程不会产生重复副作用？”

这比继续背诵 Agent、Workflow、Lease 的定义，更接近资深 AI Backend 面试对系统正确性和工程取舍的要求。

2026-11-06_agent_review_recovery_ADR.md
文档
星期一 10:37
