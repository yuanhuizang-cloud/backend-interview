---
id: gateway-types-comparison
type: 概念题
difficulty: hard
tags: [Agent Gateway, LLM Gateway, Tool Gateway]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
Agent Tool Gateway 和 Agent Gateway 有什么区别 我理解openclaw是agent gateway，litellm是llm gateway llm-d是推理调度gateway 那tool gateway和他们是什么关系 目前github开源社区或公司/创业者 有在做类似的产品或工具的吗 有没有有雏形的

## 回答
可以。内部落地先不要做“FDE Delivery Platform”这个大名字，也不要先造 Agent Gateway。 先做一个真实业务闭环，然后把其中重复部分抽象出来。

我建议你在公司内部走这条路线：

第一落地点：研发故障排查助手（Read-only Incident Copilot）
底层复用：现有 LLM Gateway + agentgateway/MCP Gateway + 你写的 Tool Onboarding 层
核心价值：把 Prometheus / K8s / GitLab 等已有系统快速变成安全 Agent Tool。

这样既能最快验证，又能逐渐长成你想要的 “给 FDE/Agent 开发者提供工具”。

1. 先明确这次内部项目到底交付什么

第一版不要叫：

Agent Tool Gateway Platform

公司里没人天然关心这个。

你对 Leader 的表述应该是：

现在研发排查线上问题，需要手动在监控、K8s、GitLab 等多个系统之间查询信息。我想做一个只读的 AI 排障助手，先自动完成信息收集和初步归因，减少重复查询时间。
同时把这些系统的 AI Tool 接入方式沉淀成标准组件，以后其他 Agent 可以复用。

这个说法有：

纯文本
业务价值
+
AI 应用
+
基础设施沉淀

三层。

2. 第一版用户体验就做到这里

例如开发收到报警：

backend-api P99 最近 30 分钟为什么突然升高？

Agent 自动执行：

纯文本
① prometheus.query
   → P99 从 220ms 升到 1.8s

② prometheus.query
   → memory 逐步上涨

③ k8s.get_pods
   → pod restartCount = 3

④ k8s.get_events
   → 14:32 OOMKilled

⑤ gitlab.recent_deployments
   → 14:10 有新版本发布

最后回答：

纯文本
初步判断：
P99 上升与 Pod OOM 重启高度相关。

证据：
- 14:28 memory 接近 limit
- 14:32 Pod OOMKilled
- 14:32–14:35 P99 明显上升
- 14:10 有一次版本发布

建议：
1. 检查该版本内存分配变化
2. 对比 heap / alloc profile
3. 检查大对象及 goroutine 数量

注意：

第一版坚决不让 AI restart Pod、不 rollback、不改生产配置。

Read-only 能极大降低内部上线阻力。

3. 技术架构就定成这样

你们已经有 LLM Gateway，就不要重做。

纯文本
                 飞书 / Web / CLI
                       │
                       ▼
                Incident Agent
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
         LLM Gateway      agentgateway / MCP
              │                 │
              ▼                 ▼
       OpenAI / DeepSeek     Tool Layer
                                │
                ┌───────────────┼──────────────┐
                ▼               ▼              ▼
           Prometheus         K8s           GitLab
                │               │              │
                └───────────────┼──────────────┘
                                │
                         Trace / Audit
                                │
                    OpenTelemetry / Grafana

这里你真正自己开发的不是 gateway 核心协议，而是：

Internal Tool Onboarding Layer

即：

纯文本
公司已有系统
     ↓
描述 API / OpenAPI
     ↓
转换成 Agent Tool / MCP Tool
     ↓
权限配置
     ↓
安全凭证
     ↓
注册
     ↓
测试
     ↓
Agent 可调用

这个才是以后能发展成 FDE Delivery Kit 的东西。

4. 你的核心代码应该是什么

第一版只定义一个 Tool 配置模型：

YAML
name: k8s.get_events

description: >
  Query Kubernetes events for a workload.

risk: read

owner: platform

timeout: 5s

permissions:
  - k8s.read

backend:
  type: kubernetes

observability:
  trace: true
  audit: true

Agent 只看到：

纯文本
k8s.get_events

不知道：

纯文本
Kubeconfig
ServiceAccount Token
Prometheus Token
GitLab Token

真正调用由 Gateway / Tool Runtime 执行。

5. 第一批只接 4 个 Tool

不要多。

Tool	用途
prometheus.query	指标查询
k8s.get_pods	Pod 状态
k8s.get_events	OOM / Crash / 调度异常
gitlab.recent_deployments	判断最近是否发布

等真实用户告诉你缺什么，再增加。

例如有人连续反馈：

“我每次最后都还需要查日志。”

那再加：

纯文本
logs.search

不要提前想 30 个 Tool。

6. 第一周不要编码 5 天，第一天先做 Discovery

你现在需要找公司里 2–3 个真实用户：

1 个后端；
1 个 SRE/运维；
最好再加 1 个 Tech Lead。

拿最近 5 个真实线上问题。

比如：

纯文本
CPU 100%
OOMKilled
P99 上升
Pod CrashLoop
下游 5xx

让对方把真实排查过程说一遍。

你记录：

纯文本
收到报警
↓
先打开哪里？
↓
查什么？
↓
看到什么以后去哪里？
↓
最终在哪发现问题？
↓
用了多久？

然后把操作步骤分类。

你很可能得到：

纯文本
人工判断：20%

机械信息收集：80%

Agent 第一版就只吃掉后面的 80%。

这是非常典型的 FDE discovery。

7. 第一天就建立 Baseline

否则一个月以后你会发现：

“大家觉得挺不错。”

但完全无法证明价值。

先记录：

指标	当前人工 Baseline
找到第一条有效证据时间 TTFE	X min
初步判断时间 TTD	X min
平均打开系统数	X
人工查询步骤	X
新人是否能独立完成	Yes/No

未来项目最漂亮的指标可能根本不是：

Diagnosis Accuracy 93%。

而是：

平均首次证据获取时间从 8 分钟降低到 90 秒。

这个极其可信。

8. 第一周：做 Vertical Slice

不要分模块做完再集成。

第一周目标只有一句话：

用户输入一句问题 → Agent 调两个真实内部 Tool → 得到有证据的回答。

Day 1：

纯文本
真实事故 Discovery
+
Baseline
+
选 1 个场景

Day 2：

纯文本
LLM Tool Calling
+
prometheus.query

Day 3：

纯文本
k8s.get_pods
+
k8s.get_events

Day 4：

纯文本
Agent loop
+
structured output
+
evidence

Day 5：

纯文本
部署 dev
+
找第一个用户真实试用

第一周结束必须已经有人能用。

不是：

Registry 模块完成 80%。

9. 第一版 Agent Loop 不要 LangGraph 化

你甚至可以自己写：

Go
for {
    resp := llm.Call(messages, tools)

    if len(resp.ToolCalls) == 0 {
        return resp
    }

    for _, call := range resp.ToolCalls {
        result := toolGateway.Execute(ctx, call)
        messages = append(messages, result)
    }
}

你需要真正掌握：

纯文本
LLM
→ tool selection
→ execute
→ observation
→ next reasoning

以后再决定是否需要 LangGraph。

10. 第二周：把 Demo 变成工程

这周才加入真正体现你后端能力的东西：

纯文本
Authentication

RBAC

ServiceAccount

Secret isolation

context timeout

semaphore

rate limit

retry policy

audit log

OpenTelemetry

metrics

尤其你最近面试一直被追问的：

Context；
Semaphore；
bounded concurrency；
retry storm；
timeout；
下游异常；

全部放进这里。

以后再被问：

Tool 下游 5xx 怎么办？

你直接回答真实实现：

纯文本
Agent
↓
Tool Runtime
↓
per-tool timeout
↓
retryable error classification
↓
exponential backoff
↓
max retry
↓
circuit breaker

而不是背概念。

11. Tool Runtime 要统一控制

核心路径应该是：

纯文本
ToolCall
   ↓
Authenticate
   ↓
Authorize
   ↓
Validate Args
   ↓
Check Risk Policy
   ↓
Acquire Concurrency
   ↓
Context Timeout
   ↓
Call Backend
   ↓
Audit
   ↓
Trace
   ↓
Return ToolResult

不要把：

纯文本
timeout
retry
auth
logging

分别写进每一个 Tool。

否则以后接 30 个 Tool 就又回到了重复建设。

12. 第三周开始做 Eval

你可以直接拿前面收集的真实事故做 dataset。

例如：

JSON
{
  "question": "payment-service为什么P99升高？",
  "expected_tools": [
    "prometheus.query",
    "k8s.get_events"
  ],
  "expected_facts": [
    "OOMKilled"
  ],
  "forbidden_actions": [
    "restart_pod"
  ]
}

先做 20 个。

评估：

Metric	意义
Tool Selection Accuracy	工具选得对不对
Evidence Recall	有没有找到关键事实
Groundedness	结论是否有证据
Unsafe Action Rate	是否做危险建议
Tool Call Count	有没有乱调用
Latency	是否实用

然后以后：

纯文本
修改 Prompt
修改 Model
增加 Tool
修改 Agent Loop

必须：

纯文本
run eval

这样你的项目才开始真正有 AI Engineering 味道。

13. 第三周就开始 Beta，不要等“完成”

找 5 个种子用户。

而且要规定：

不要专门给我测试 Demo，下一次你真的遇到问题时就用。

最好的入口不是新 Web UI。

如果公司用飞书：

纯文本
@IncidentBot backend-api怎么了？

如果暂时接飞书麻烦：

纯文本
CLI

也比做一个漂亮前端更值得。

例如：

Bash
incident ask "backend-api 最近30分钟为什么p99升高"
14. 你应该自己跟着用户用

FDE 最大区别就在这里。

不要：

纯文本
发群：
大家有空体验一下~

然后等反馈。

你需要主动找到真实案例：

“你刚才这个告警是不是要排？这次我们一起跑一下 Agent。”

然后观察：

纯文本
用户问了什么？

Agent 理解错哪里？

Tool 缺什么？

回答哪个部分他根本没看？

最后他还是手工查了什么？

这比你自己坐着设计功能有效得多。

15. 每个错误都进入 Bad Case

回答下面直接做：

纯文本
👍 有帮助
👎 没帮助

👎 后再选：

纯文本
证据错误

漏掉关键信息

判断错误

调用 Tool 错误

速度太慢

保存：

纯文本
query
tool trajectory
tool results
answer
feedback

进入：

纯文本
bad_cases/

然后每周：

纯文本
Bad Case
↓
人工确认
↓
加入 Eval Dataset
↓
Fix
↓
Regression

你就真正建立起来：

Production → Feedback → Eval → Improvement

闭环。

16. 第四周才证明“平台化”

到这时，你不能只停在 Incident Agent。

把第二个 Agent 接进来。

最适合你的就是现有 AI Code Review：

纯文本
                    Tool Layer
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
  Incident Agent             Code Review Agent
          │                         │
      K8s / Prom             GitLab Tool

最好让：

纯文本
gitlab.get_merge_request

也通过相同：

纯文本
auth
policy
timeout
audit
trace

基础设施。

这时你才能真正对团队说：

我们不是做了一个排障机器人，而是沉淀了一套公司内部 Agent 接工具的标准能力。

17. 第五周再做 Tool Onboarding

现在才开始实现真正的 FDE Delivery Kit 核心功能：

纯文本
openapi.yaml
     ↓
fde-tool import
     ↓
解析 API
     ↓
生成 tool schema
     ↓
配置 auth
     ↓
配置 risk
     ↓
注册 gateway
     ↓
生成 smoke tests
     ↓
Agent 可用

目标指标：

新内部 API → Agent Tool < 30 min。

这就是你真正值得开源/写简历的功能。

18. 最小 CLI 可以设计成这样

例如：

Bash
fde-tool init

生成：

纯文本
tool.yaml

然后：

Bash
fde-tool validate tool.yaml

验证：

纯文本
schema ✓
auth ✓
risk policy ✓
health check ✓

再：

Bash
fde-tool register tool.yaml

最后：

Bash
fde-tool test k8s.get_events

得到：

纯文本
auth       PASS
schema     PASS
timeout    PASS
backend    PASS
trace      PASS

这比做 UI 有价值多了。

19. 内部推广话术也不要讲 Agent Infra

你跟 Leader 汇报时，应该是：

第一阶段我们验证的是线上排障，过去需要手工跨多个系统搜集信息，现在 Agent 可以自动完成 Prometheus 和 Kubernetes 的基础信息聚合。

目前 X 位研发使用了 N 次，首次证据获取时间从 X 分钟下降到 Y 分钟。

过程中发现每个 Agent 接内部 API 都会重复处理鉴权、权限、Secret、超时和审计，所以把这一层沉淀成统一 Tool Runtime。目前 Incident Agent 和 Code Review Agent 已经可以复用。

下一步准备把 OpenAPI → Agent Tool 的 onboarding 自动化。

这个故事就非常完整。

20. 你的 5 周目标应该是这样
周	目标	可见产物
Week 1	一个真实 Incident 能跑通	Vertical Slice
Week 2	能安全跑在 dev K8s	Runtime + RBAC + Trace
Week 3	5 人真实试用	Usage + Feedback + Eval
Week 4	第二个 Agent 复用	Platform Proof
Week 5	自动 Tool Onboarding	FDE Delivery Kit MVP

做到 Week 3，其实已经能写简历。

做到 Week 5，就有明显差异化。

最关键的一步：你明天做什么

这次不要再继续读框架。

你明天应该直接建立一个文档：

纯文本
Internal Incident Copilot — Discovery

填五个真实事故，每个只有：

纯文本
Incident：

发生了什么：

人工排查步骤：

用了哪些系统：

第一条有效证据：

耗时：

哪些步骤是机械操作：

可以暴露哪些 read-only API：

当这五个 case 填完，我们才能决定：

第一个 Tool 到底应该是 Prometheus、K8s、日志，还是 GitLab。

这一步我建议你认真做。因为真正能让这个项目从“个人作品”变成“公司实际落地”的分水岭，不是你能不能把 Agent Gateway 跑起来，而是你有没有找到一个真实的、值得自动化的内部 workflow。

ChatGPT 可能会出错。请核查重要信息。
最新一条回复




思考强度
5.6 中
