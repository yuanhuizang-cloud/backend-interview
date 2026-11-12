---
id: deepseek-harness-source
type: 其他
difficulty: medium
tags: [Harness, 源码, Agent]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
那deepseek harness源码我值得读吗 是不是搞懂了deepseek harness 我就可以用它来做任何agent了 我理解他虽然是一个编程 agent 类似于codex、claude code ，但是里面的工具调用 重试 降级 监测 等架构 我可以借鉴 是这样吗 还是我的理解有误

## 回答
你的理解大方向是对的，但有两个地方需要校准。

第一：DeepSeek Harness 值得你读源码。
第二：搞懂它 ≠ 你就“可以用它做任何 Agent”。 更准确地说，它能帮你掌握一套相当通用的 Agent Runtime / Agent Harness 架构模式，之后你做别的 Agent，会知道底层骨架该怎么设计。

DeepSeek 官方自己把它定义为一个开源 agent harness，而不是单纯的“编程 Agent”。它的核心理念是 everything is a plugin，并且把 session、system prompt、tools、agent、agent loop、LLM adapter 等能力拆开。
GitHub
+1

你可以先把它和 Claude Code / Codex 区分开

Claude Code / Codex 更像一个具体产品：

纯文本
用户
 ↓
Coding Agent
 ↓
读代码 / 改文件 / 跑命令 / 测试 / Git

而 DeepSeek Harness 更接近：

纯文本
          Agent Runtime
              │
 ┌────────────┼──────────────┐
 │            │              │
Agent Loop   Tools          Session
 │            │              │
LLM          Sandbox       Persistence
 │            │              │
Prompt      Permission     Events
 │
Subagent / Scheduling / UI ...

官方核心架构里，一个 turn 大致就是：

纯文本
prompt
  ↓
agent-loop
  ↓
session log
  ↓
system prompt assembly
  ↓
LLM
  ↓
tool calls
  ↓
tool registry / execution
  ↓
result append to session
  ↓
next step

这其实就是一个非常标准的 Agent execution loop。
GitHub
+1

所以对你来说，它真正值得学的不是：

“DeepSeek Harness 的 API 怎么用”

而是：

一个成熟 Agent Runtime 到底应该有哪些抽象，以及这些抽象之间怎么解耦。

你说“工具调用、重试、降级、监测等架构可以借鉴”，这个判断基本正确

但我会把值得借鉴的东西分成三层。

第一层：最值得你读 —— Agent Loop

这是核心中的核心。

你刚刚问 function calling 时，我们讲的是：

纯文本
LLM
 ↓
tool_call
 ↓
runtime execute
 ↓
tool_result
 ↓
LLM

DeepSeek Harness 的 agent-loop 就是在工程化这个过程。

官方把 agent-loop 定义为默认 Agent driver：负责创建 Agent、驱动 turn / step 生命周期，并通过 LLM seam 获取流式响应，再把 tool call 分发到 tool registry。
GitHub
+1

你应该重点看这些问题：

纯文本
while true {

    request := buildContext()

    response := llm.Call(request)

    if response.FinalAnswer {
        break
    }

    for _, toolCall := range response.ToolCalls {
        result := tools.Execute(toolCall)

        session.Append(result)
    }
}

现实源码当然不会这么简单。

真正值得看的恰恰是：

纯文本
什么时候继续 loop？
什么时候结束？

tool error 怎么处理？
cancel 怎么传播？

streaming 怎么进入状态机？
一个 turn 和 step 怎么定义？

session 怎么恢复？
中途中断怎么办？

tool result 怎么回填 context？
并发 tool 怎么处理？

subagent 怎么启动？
parent/child agent 怎么通信？

这些都是你将来做任何 Agent 都会碰到的。

第二层：Tool Runtime

这个对你也非常重要。

官方不是简单：

TypeScript
tools[name](args)

而是有一个 scoped tool registry + guarded execution pipeline。
GitHub
+1

也就是说真实 Agent 的 tool 调用其实应该想成：

纯文本
LLM tool_call
      ↓
Tool Registry
      ↓
schema validation
      ↓
permission check
      ↓
sandbox policy
      ↓
execution
      ↓
timeout / cancellation
      ↓
result normalization
      ↓
session

这已经跟传统后端非常像了。

例如你的 K8s Incident Agent：

纯文本
get_pods
get_logs
query_prometheus
restart_pod
delete_pod

显然：

纯文本
get_logs

和：

纯文本
delete_pod

不能拥有相同权限。

所以 Agent Runtime 需要：

纯文本
read-only tool
        ↓
自动允许

dangerous tool
        ↓
approval
        ↓
sandbox / RBAC

DeepSeek Harness 本身就有 approval、sandbox policy、permission preset 等明确的 capability seam；例如工具执行可以通过 approval 流程，sandbox policy 可以控制执行环境。
GitHub
+1

这部分对你做：

K8s Incident Agent

尤其有价值。

第三层：Plugin Architecture

这个反而是 DeepSeek Harness 比普通 Agent demo 更值得读的地方。

它的核心思想是：

Agent 的能力不是硬编码进一个巨大的 Agent class，而是组合出来。

例如：

纯文本
Agent
 │
 ├─ LLM plugin
 ├─ Tool plugin
 ├─ Session plugin
 ├─ Sandbox plugin
 ├─ Permission plugin
 ├─ Subagent plugin
 ├─ Schedule plugin
 └─ UI plugin

官方现在明确采用 “everything is a plugin” 的架构，而且 packages 按能力组拆分。
GitHub
+1

这对你这个后端工程师尤其值得学。

因为很多初级 Agent 实现是：

Python
class Agent:

    def __init__():
        self.llm = ...
        self.tools = ...
        self.memory = ...

    def run():
        ...

几千行以后就变成：

纯文本
God Object

而 Harness 的思路更像微内核：

纯文本
                  Core Runtime
                       │
           ┌───────────┼────────────┐
           ↓           ↓            ↓
        Plugin      Plugin        Plugin
        tools       session       sandbox

这其实和你熟悉的：

纯文本
middleware
interface
dependency injection
event bus
plugin system

非常接近。

但“搞懂 DeepSeek Harness 就能做任何 Agent”不太准确

应该改成：

搞懂 DeepSeek Harness 后，你会掌握很多通用 Agent Runtime 的设计模式，但不同 Agent 的 domain logic、tools、workflow、evaluation 和 safety 仍然需要单独设计。

比如：

Coding Agent

需要：

纯文本
filesystem
shell
git
compiler
test runner
code search
K8s Incident Agent

需要：

纯文本
Kubernetes API
Prometheus
logs
events
traces
RBAC
incident knowledge
Code Review Agent

需要：

纯文本
Git diff
AST
repo search
lint
test
review rules
Customer Support Agent

则可能是：

纯文本
CRM
order DB
knowledge base
ticket system
refund workflow

它们共用的是：

纯文本
                  通用 Agent Runtime

                       Agent Loop
                           │
              ┌────────────┼────────────┐
              ↓            ↓            ↓
           Context        Tools        Session
              │            │            │
           Model        Permission   Persistence
              │            │
           Retry        Sandbox
              │
          Observability

而不同的是：

纯文本
Domain Tools
Domain Prompt
Domain Workflow
Domain Evals
Domain Safety Policy

所以 Harness 更像：

操作系统 / Web Framework

而不是：

一个万能 Agent。

你可以类比 Gin。

学懂 Gin 不代表：

纯文本
会 Gin
=
会做任何互联网产品

但是你会掌握：

纯文本
routing
middleware
context
request lifecycle
error handling

以后做：

纯文本
电商
支付
CMS
后台

都有共同基础。

Harness 对 Agent 就类似这个作用。

你刚才提到“重试、降级、监测”，我要特别纠正一个点

不要预设 DeepSeek Harness 已经把我们传统后端里所有 production 能力都完整实现好了。

它目前官方仍明确标为：

Developer Preview，并提醒未来存在 breaking changes。
GitHub

而且我目前查到的架构里，明确且很值得研究的包括：

纯文本
Agent loop
Session
Tool registry
LLM adapter
Streaming
Cancellation
Events
Sandbox
Permission / Approval
Subagent
Scheduling
Plugin composition

例如它的 Agent API 明确包含：

纯文本
create / resume
follow-up / steering
context injection
cancel
wait until idle

并强调 agent driver 可替换。
GitHub

但：

纯文本
model fallback
retry policy
circuit breaker
rate limiting
distributed queue
SLO monitoring

这些你不能简单认为 Harness 已经提供了和生产网关一样成熟的一套实现。

这反而给你一个很好的学习方法：

看它实现了什么，同时看它没实现什么。

对你而言，最有价值的不是“读完整源码”

我不建议你：

纯文本
git clone

↓
从 packages 第一行开始读

↓
一周之后：

“Cordis 到底是什么？”

这会陷入源码阅读陷阱。

你应该带着一个问题读。

我建议你的阅读顺序是：

纯文本
1. architecture.md

        ↓

2. agent-loop

        ↓

3. tools

        ↓

4. session

        ↓

5. LLM adapter / streaming

        ↓

6. sandbox / permission

        ↓

7. subagent

        ↓

8. plugin / Cordis

而且每一层都回答一个问题。

比如第一轮只回答：

Q1

一个用户请求如何经过 Harness 最后变成模型调用？

Q2

模型返回 tool_call 后是谁执行？

Q3

tool result 怎么回到模型？

Q4

为什么 Agent 可以连续调用 5 个 tool？

Q5

Agent 怎么知道什么时候停止？

如果你把这 5 个问题通过源码追通，

已经比：

“我读完 DeepSeek Harness”

有价值很多。

然后第二轮看生产问题

比如：

纯文本
LLM timeout 了怎么办？

Tool timeout 怎么办？

用户 cancel 怎么传播？

执行 bash 谁控制权限？

Agent crash 后 session 怎么恢复？

Tool call 是否幂等？

subagent 失效怎么办？

context 太长怎么办？

这时候你过去 8 年后端经验会开始发挥作用。

你可能会不断产生这种感觉：

“这不就是 distributed system / backend runtime 的老问题，只是 execution unit 换成了 Agent。”

这其实就是你转 AI Backend 最重要的一步。

甚至我觉得它比你现在先啃 LangChain 源码更适合

因为你目前真正想建立的是：

纯文本
AI Backend / Agent Infrastructure

而不是：

纯文本
会调用 LangChain API

DeepSeek Harness 给你的视角更接近：

纯文本
Agent Runtime

而不是：

纯文本
Agent Application SDK

从你的背景来说，这种源码更能发挥你：

纯文本
Go / Backend
分布式系统
资源治理
稳定性
K8s
可观测性

这些已有优势。

我会把你的目标进一步收敛

你不需要追求：

“搞懂 DeepSeek Harness。”

这个目标太大。

你真正应该追求的是：

“借 DeepSeek Harness，把 Agent Runtime 的核心机制搞懂，然后自己实现一个缩小版。”

比如最终你能自己写出：

纯文本
Mini Agent Runtime

User
 ↓
Agent Loop
 ↓
Model Adapter
 ↓
Tool Call
 ↓
Tool Registry
 ↓
Permission
 ↓
Execution
 ↓
Observation
 ↓
Session
 ↓
Next Step

再加：

纯文本
timeout
retry
cancel
trace
token usage
tool latency
max steps

最后把：

纯文本
kubectl
Prometheus
logs

接进去。

就变成：

Kubernetes Incident Agent

这时 DeepSeek Harness 就不只是“我看过一个开源项目”。

而是你面试可以真正说：

我参考 DeepSeek Harness 这类 Agent Harness 的设计，把 Agent Loop、Tool Runtime、Session、Permission 和 Observability 做了拆分；业务层接入 Kubernetes 和 Prometheus 工具，并针对 Agent 场景增加 step limit、tool timeout、RBAC 和 trace。

这个含金量明显高很多。

所以我的结论是：

值得读，而且对你现在是高杠杆源码。
但你的目标不应该是“把十几万行代码读懂”，而应该是用它作为参照系，理解并复刻 Agent Runtime 的核心 20%。官方本身也提供了最小 SDK、headless agent、JSON-RPC agent、MCP memory 等例子，很适合沿着这一思路逐层拆。
GitHub
+1

如果按照我们之前定的“学习必须转成作品”的原则，我会把 DeepSeek Harness 源码阅读 → Mini Harness → K8s Incident Agent 直接串成同一个项目，而不是把“读源码”单独当学习任务。

ChatGPT 可能会出错。请核查重要信息。
最新一条回复




思考强度
5.6 中
