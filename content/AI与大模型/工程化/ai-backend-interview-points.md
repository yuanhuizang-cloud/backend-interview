---
id: ai-backend-interview-points
type: 场景题
difficulty: hard
tags: [限流, 超时, 重试, Agent]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
AI Backend 招聘并不只看是否会调用模型，还会看： 模型调用如何限流、超时和重试 如何避免重试风暴 Agent 任务如何持久化和恢复 Tool Calling 如何鉴权 RAG 如何评测 多租户如何隔离 如何做 tracing、成本和延迟监控 如何部署及灰度升级 这些具体我该怎么做 怎么补齐工程落地经验方面的面试

## 回答
这些能力不能靠“背答案”补齐。最有效的办法是做一个项目，把正常链路、异常链路、监控、评测和发布全部跑通。

建议你做：

多租户企业知识库 + Agent Backend
Go 负责 API、任务状态、鉴权和治理；Python 负责文档处理与评测；PostgreSQL + pgvector 存储；Dify 作为调用入口。

一、项目整体架构

不要一开始就使用复杂 Agent 框架。先自己实现最小状态机、工具注册和模型调用治理，面试时才讲得清楚。

二、八项能力分别怎么落地
能力	最小实现	如何证明有效
限流、超时、重试	租户限流、并发上限、分阶段超时、有限重试	模拟429、超时、5xx
防重试风暴	重试预算、熔断、抖动退避、有界队列	模型连续失败时观察请求量
Agent 持久化恢复	PostgreSQL 状态机、Checkpoint、租约	执行中杀死 Worker，再恢复
Tool 鉴权	工具注册表、RBAC、资源范围、高危审批	构造越权和 Prompt Injection
RAG 评测	标准问题集、Recall@K、引用正确率	修改切分策略前后对比
多租户隔离	tenant_id、RLS/查询过滤、配额、缓存隔离	租户 A 不能检索到 B 的数据
tracing、成本监控	OTel Trace、Token/费用/延迟指标	一次请求能够完整追踪
部署与灰度	K8s、探针、滚动发布、5% 灰度、回滚	发布失败版本并自动/手动回滚
1. 模型调用如何限流、超时和重试

至少设置三层保护：

租户限流：Token Bucket，例如每个租户 60 RPM。
全局并发：semaphore，例如模型调用同时最多 10 个。
有界队列：例如最多等待 100 个任务，满了直接返回过载。

超时不要只设置一个 http.Client.Timeout，而是做超时预算：

纯文本
请求总预算：10 秒
├── 检索：1.5 秒
├── Rerank：1.5 秒
├── 模型调用：6 秒
└── 返回与缓冲：1 秒

重试规则：

只重试网络错误、429、502、503、504。
参数错误、鉴权错误、内容安全拒绝不重试。
最多重试两次。
指数退避加随机抖动。
尊重服务端 Retry-After。
流式响应已经向客户端输出后，不能自动从头重试。

验收实验：

Mock 模型服务固定返回429。
第一次200ms、第二次约400ms退避。
超过总超时预算后立即取消。
查看实际总调用次数、延迟和队列长度。

面试时就能讲：“我不是简单配置三次重试，而是以总超时预算为边界，只对可恢复错误重试。”

2. 如何避免重试风暴

重试风暴的本质是：

下游容量下降 → 上游超时 → 大量重试 → 下游压力进一步上升。

具体措施：

原始请求和重试请求都占用同一个并发额度。
设置重试预算，例如一分钟内重试数不超过原始请求数的10%。
连续失败达到阈值后打开熔断器。
熔断期间快速失败或切换备用模型。
队列必须有界，不能无限积压。
通过随机抖动避免实例同时重试。
对写操作设置幂等键。
不在网关、业务服务、SDK 三层同时无脑重试。

故障实验：

让模型服务在一分钟内全部返回503。
对比“无限重试”和“重试预算+熔断”两种模式。
记录模型服务实际收到的请求量、错误率、P95和队列深度。

这份对比图就是很强的面试证据。

3. Agent 任务如何持久化和恢复

不要只把 Agent 执行状态放在内存里。

设计任务状态机：

纯文本
PENDING
  ↓
RUNNING
  ├── WAITING_RETRY
  ├── WAITING_APPROVAL
  ├── SUCCEEDED
  ├── FAILED
  └── CANCELED

任务表至少包含：

纯文本
id
tenant_id
status
current_step
input
checkpoint
attempt
max_attempts
lease_owner
lease_expires_at
next_run_at
error_code
created_at
updated_at
version

核心机制：

每完成一个模型调用或工具调用就保存 Checkpoint。
Worker 领取任务时写入带过期时间的租约。
Worker 崩溃后，租约到期，其他 Worker 可以继续领取。
外部副作用使用 run_id + step_id 作为幂等键。
使用乐观锁 version 防止两个 Worker 同时推进任务。
超过最大重试次数进入失败队列，等待人工处理。

必须做的演示：

Agent 完成检索。
正在调用工具时强制杀死 Worker。
重启 Worker。
从上一个 Checkpoint 恢复。
已执行的工具不重复产生副作用。

面试时不能说“用了数据库，所以可以恢复”，而要讲清楚：

从哪个状态恢复
如何防止重复执行
如何判断任务所有权
恢复后是否继续沿用原请求的 Context

注意：HTTP 请求的 context 取消后，持久化后台任务不能直接依赖原请求 Context，应有独立任务 deadline。

4. Tool Calling 如何鉴权

最重要的原则：

模型只能建议调用工具，服务端才有权决定是否执行。

工具注册表可以包含：

纯文本
tool_name
allowed_roles
resource_scope
risk_level
timeout
max_result_size
requires_approval
enabled

鉴权链路：

用户携带 JWT 请求 Agent。
服务端解析 tenant_id/user_id/roles。
模型生成 Tool Call。
Tool Runtime 根据用户、租户、角色和资源范围重新鉴权。
高风险工具进入 WAITING_APPROVAL。
通过审批后发放一次性、短时、最小权限凭证。
执行结果经过大小限制和内容过滤后再返回模型。

工具风险可以分级：

低风险：查询知识库、读取监控指标。
中风险：创建工单、发送草稿。
高风险：删除资源、执行SQL、部署、发送正式消息。

必须验证：

租户 A 调用工具读取租户 B 的资源。
Prompt 中要求忽略权限规则。
模型伪造一个不存在的工具名。
用户让工具执行超出授权范围的参数。

这些请求都必须由服务端拒绝，不能依赖 Prompt 里写“请勿越权”。

5. RAG 如何评测

RAG 必须拆成两层评测。

检索评测

建立50～100条标准数据：

JSON
{
  "question": "如何回滚知识库索引版本？",
  "expected_document_ids": ["doc-17"],
  "expected_keywords": ["索引版本", "回滚"]
}

指标：

Recall@K：正确文档是否出现在前K个结果里。
MRR：正确文档排得是否足够靠前。
nDCG：多个相关文档的排序质量。
无结果率。
检索P95。
回答评测

指标：

答案正确率。
引用是否支持结论。
忠实度/幻觉率。
应当拒答时是否拒答。
Token和费用。
端到端延迟。

至少做三组对比：

固定长度切分 vs 语义/标题切分。
纯向量检索 vs 混合检索。
不使用 rerank vs 使用 rerank。

最终产出一张表：

版本	Recall@5	引用正确率	P95	单次成本
V1 纯向量	实测	实测	实测	实测
V2 混合检索	实测	实测	实测	实测
V3 + rerank	实测	实测	实测	实测

这比“我使用了 pgvector”有说服力得多。

6. 多租户如何隔离

所有业务对象必须包含 tenant_id：

knowledge_bases
documents
chunks
agent_runs
tool_grants
model_calls

同时做到：

数据库查询必须带 tenant_id。
缓存 Key 必须包含租户。
对象存储路径按租户分隔。
API Key 按租户保存和加密。
限流、费用配额按租户统计。
后台任务携带并校验租户上下文。
可以使用 PostgreSQL RLS 作为第二道防线。

特别注意 pgvector：HNSW 等近似索引与租户过滤结合时，过滤可能发生在近邻扫描之后，导致召回数量和性能受到影响。租户数量较少时可以分区，重要租户可以独立表或独立索引。pgvector 官方也专门说明了共享近似索引可能影响多租户召回，并建议使用分区或独立表。
GitHub

必须写一个自动化测试：

插入两个租户内容相似的文档，租户 A 查询时，返回结果中不能出现任何租户 B 的 chunk。

7. tracing、成本和延迟监控

使用 OpenTelemetry 串起：

纯文本
HTTP 请求
→ 鉴权
→ RAG 检索
→ Rerank
→ LLM 调用
→ Tool Call
→ 数据库持久化

关键 Span 属性：

tenant_id：生产中建议脱敏或哈希
run_id
model
provider
prompt_version
retrieval_top_k
input_tokens
output_tokens
retry_count
status/error_type
time_to_first_token
total_latency
estimated_cost

关键指标：

请求量和错误率
P50/P95/P99
TTFT
Token使用量
单租户费用
模型错误分类
429次数
重试次数
熔断状态
Agent成功率
队列长度和任务等待时间
RAG无结果率

OpenTelemetry 已经为 traces、metrics、logs，以及生成式 AI 属性建立了语义约定，可以参考其统一命名，而不是随意设计字段。
OpenTelemetry
+1

不要默认记录完整 Prompt、文档内容和工具结果，避免泄露隐私与凭证。

8. 如何部署和灰度升级

先完成两个环境：

本地：Docker Compose
演示环境：kind/minikube + Kubernetes

Kubernetes 至少包含：

Deployment
Service
ConfigMap/Secret
readinessProbe
livenessProbe
requests/limits
PodDisruptionBudget
HPA
graceful shutdown
数据库 Migration Job

发布时要区分两种灰度：

服务版本灰度
V1 接收95%流量。
V2 接收5%流量。
对比错误率、P95、Token成本和回答质量。
达标后逐渐扩大流量。
异常则把流量切回V1。

Kubernetes 原生 Deployment 支持滚动更新和回滚；`maxUnavailable`、`maxSurge` 控制发布期间不可用实例数和额外实例数。
Kubernetes

AI 配置灰度

模型、Prompt、切分策略、Embedding版本都要有版本号：

纯文本
model_version
prompt_version
retrieval_version
embedding_version
index_version

否则回答变差时，你无法判断是哪一项变化导致的。

数据库变更使用 expand-contract：

先添加兼容字段。
新旧版本同时可运行。
完成数据回填。
全量切到新版本。
最后删除旧字段。
三、六周执行计划
周次	开发内容	面试产出
第1周	文档导入、切分、Embedding、pgvector检索、Dify查询接口	RAG完整链路
第2周	限流、超时、重试、熔断、有界队列	429/5xx故障报告
第3周	Agent任务状态机、Checkpoint、租约、幂等	Worker崩溃恢复演示
第4周	Tool Registry、RBAC、租户隔离、高危审批	越权攻击测试
第5周	OTel、Grafana、费用统计、RAG评测集	Trace截图和评测报告
第6周	K8s部署、灰度、回滚、压测	演示视频与部署文档

每周投入8～10小时即可。不要先开发管理后台，Dify可以承担交互界面，把时间集中在后端工程问题上。

四、怎样把个人项目变成“面试可用经验”

个人项目不能说成生产项目，但可以说成：

针对企业知识库场景完成了生产化工程验证，包括多租户隔离、持久化任务、模型调用治理、RAG评测、全链路观测和Kubernetes灰度发布。

要形成这些证据：

GitHub代码仓库
架构图
ADR：为什么选择PostgreSQL任务状态机
ADR：为什么只重试特定错误
评测数据集与对比结果
压测报告
故障注入报告
Grafana和Trace截图
5分钟演示视频
一份运行手册和故障处理手册

如果能在公司内部找到2～5名真实用户，用脱敏文档试用两周，再记录查询次数、命中率、反馈和实际失败案例，这就从“个人 Demo”升级成了“小范围真实落地”。

五、面试时统一使用这个回答结构

每项能力都按五步回答：

业务目标和SLO
最初设计
识别到的风险
最终机制与取舍
如何验证以及实际结果

例如回答模型重试：

我给一次问答设置10秒总预算，其中检索1.5秒、rerank 1.5秒、模型调用6秒。只对网络错误、429和部分5xx重试，最多两次，并采用指数退避和随机抖动。所有重试都占用同一个并发额度，同时设置10%的重试预算。连续失败触发熔断，避免模型服务故障时大量请求继续放大。最后通过Mock 429和503进行故障注入，验证请求放大倍数、队列深度、P95和恢复时间。

这就已经是比较完整的高级 AI Backend 回答，而不是只说“我用了重试和熔断”。

你的第一阶段先完成前四项：模型调用治理、重试风暴、持久化任务、Tool 鉴权。它们与你原来的稳定性、Worker Pool、Context、幂等和消息系统经验连接最紧，也最容易在短时间内做出可信结果。

最新一条回复
你暂时已用完工作用量
升级订阅或添加额度，即可立即继续使用 Work；也可以等到用量在 在 16:36 重置
添加额度
升级




GPT-5.6 Sol
高
无
极低
轻度
中
高
极高
Max
Ultra
持续
