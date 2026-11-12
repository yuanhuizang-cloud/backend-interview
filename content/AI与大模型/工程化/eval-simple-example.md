---
id: eval-simple-example
type: 手撕代码
difficulty: medium
tags: [eval, 评测]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
你帮我写一个evals的最简单的例子 在帮我理解一下 我现在感觉 其实就是写yaml定义eval的名字（评估的测试名），然后提供数据集（jsonl），最后运行eval的命令进行执行 就能得到结果 不知道我理解的对不对 帮我列出yaml的构成（结构和字段） 然后jsonl如何写 比如我不知道如何写prompt、ideal和问题 思考了 13s GitHub 精选

## 回答
你的理解基本正确：

纯文本
JSONL 数据集：放每一道测试题
YAML 注册 eval：说明这个 eval 叫什么、用哪种评测模板、数据文件在哪里
oaieval 命令：选择一个模型/CompletionFn，运行这个 eval
结果：得到 accuracy、日志、每条样本是否命中

但要补一个关键点：

YAML 不只是写 eval 名字。它还要指定“用什么评测逻辑”。
比如最简单的 Match、`Includes`、`FuzzyMatch`，或者更复杂的 model-graded eval / custom eval。

OpenAI Evals 官方文档把构建 eval 分成三步：准备 JSONL 数据、在 evals/registry/evals 下注册 YAML、用 oaieval 运行；并说明 JSONL 中每一行是一个独立样本，基础 eval 通常需要 input 和 ideal 字段。
GitHub

1. 最小例子：评测模型是否能回答 Go 基础问题
目录结构

在 openai/evals 仓库里放两个文件：

纯文本
evals/
  registry/
    evals/
      go_basic.yaml
    data/
      go_basic/
        samples.jsonl
2. JSONL 怎么写？

文件：

纯文本
evals/registry/data/go_basic/samples.jsonl

内容：

jsonl
{"input": [{"role": "system", "content": "你是一个资深 Go 后端面试官。回答必须简洁，只输出最终答案。"}, {"role": "user", "content": "Go 中用于启动新 goroutine 的关键字是什么？"}], "ideal": "go"}
{"input": [{"role": "system", "content": "你是一个资深 Go 后端面试官。回答必须简洁，只输出最终答案。"}, {"role": "user", "content": "Go 中用于等待多个 goroutine 完成的标准库类型通常是什么？"}], "ideal": "sync.WaitGroup"}
{"input": [{"role": "system", "content": "你是一个资深 Go 后端面试官。回答必须简洁，只输出最终答案。"}, {"role": "user", "content": "Go 中 context.Context 最常用于传递取消信号和什么？"}], "ideal": ["超时", "deadline", "timeout"]}
每个字段是什么意思？
字段	含义	是否必须
input	给模型的输入，也就是 prompt	基础 eval 必须
ideal	标准答案，也就是期望模型答到什么	Match / Includes / FuzzyMatch 必须
question	不是基础模板的固定必需字段	可不用
answer	不是基础模板的固定必需字段	可不用

官方文档说明：所有模板都期待一个 input key，它就是 prompt，建议使用 chat format；对基础 eval Match、`Includes`、`FuzzyMatch`，还需要 ideal，可以是字符串或字符串列表。
GitHub

3. input、`question`、`ideal` 的关系

你可以这样理解：

纯文本
question：你脑子里说的“题目”
input：真正发给模型的 prompt
ideal：你希望模型答出的标准答案

在最简单的 OpenAI Evals 基础模板里，不要单独写 question，直接把问题写进 input 里。

也就是说，不写：

JSON
{
  "question": "Go 中启动 goroutine 的关键字是什么？",
  "ideal": "go"
}

而是写：

JSON
{
  "input": [
    {"role": "user", "content": "Go 中启动 goroutine 的关键字是什么？"}
  ],
  "ideal": "go"
}
4. YAML 怎么写？

文件：

纯文本
evals/registry/evals/go_basic.yaml

内容：

YAML
go-basic:
  id: go-basic.dev.v0
  description: Evaluate basic Go backend knowledge.
  metrics: [accuracy]

go-basic.dev.v0:
  class: evals.elsuite.basic.match:Match
  args:
    samples_jsonl: go_basic/samples.jsonl
YAML 结构解释
YAML
go-basic:

这是短名字 / alias。你运行命令时用它：

Bash
oaieval <MODEL> go-basic
YAML
id: go-basic.dev.v0

表示这个短名字实际指向哪个具体 eval 版本。

官方推荐命名形式是：

纯文本
<eval_name>.<split>.<version>

例如：

纯文本
go-basic.dev.v0

其中：

go-basic：评测名；
dev：数据集 split，表示开发/测试用；
v0：版本号。
GitHub
YAML
description: Evaluate basic Go backend knowledge.

说明这个 eval 是干什么的。

YAML
metrics: [accuracy]

表示最终关心的指标是准确率。

YAML
go-basic.dev.v0:
  class: evals.elsuite.basic.match:Match

这才是关键：指定评测逻辑。

这里用的是：

纯文本
Match

它的逻辑大致是：

模型输出是否以 ideal 中的某个标准答案开头。

OpenAI Evals 文档里列出基础模板：`Match`、`Includes`、`FuzzyMatch`、`JsonMatch`；其中 Match 类似检查 completion 是否以参考答案开头，`Includes` 检查参考答案是否包含在 completion 中，`FuzzyMatch` 更宽松。
GitHub

YAML
args:
  samples_jsonl: go_basic/samples.jsonl

告诉 eval 去哪里找数据文件。

官方文档说明，如果写 test_match/samples.jsonl，运行时会去 evals/registry/data/test_match/samples.jsonl 找。
GitHub

5. 运行命令

在 evals 仓库根目录下：

Bash
oaieval <MODEL> go-basic

例如文档里的形式是：

Bash
oaieval gpt-3.5-turbo test-match

当前实际运行时，把 <MODEL> 换成你账号里可用的 OpenAI 模型名即可。官方文档说明，`oaieval` 需要传入一个 completion function 或模型名，以及 eval 名称；有效 eval 名来自 evals/registry/evals 下的 YAML。
GitHub

6. 结果怎么看？

运行后你会看到类似：

纯文本
accuracy: 0.6667

并且本地会生成 JSONL 日志。

官方文档说明，`oaieval` 默认会把事件记录到本地 JSONL logs，默认路径在 tmp/evallogs，可以用文本编辑器或程序分析。
GitHub

你要重点看两层结果：

层级	看什么
总体结果	accuracy 是多少
单条样本	哪些题错了，模型输出了什么，ideal 是什么
7. Match、`Includes`、`FuzzyMatch` 怎么选？
模板	判断方式	适合场景
Match	输出是否以标准答案开头	答案很短、格式很固定
Includes	输出里是否包含标准答案	模型可能解释几句，但必须包含关键词
FuzzyMatch	更宽松匹配	答案有轻微变体
JsonMatch	JSON 完全匹配	需要结构化 JSON 输出

例如你这个问题：

纯文本
Go 中启动 goroutine 的关键字是什么？

用 Match 可以。

但如果你问：

纯文本
解释 context.Context 的作用

就不适合 Match，因为正确答案可能有很多说法。这时更适合：

Includes
model-graded eval
自定义 scorer
8. 换成 Includes 的版本

如果你希望模型可以多解释几句，只要包含关键词就算对，可以改 YAML：

YAML
go-basic:
  id: go-basic.dev.v0
  description: Evaluate basic Go backend knowledge.
  metrics: [accuracy]

go-basic.dev.v0:
  class: evals.elsuite.basic.includes:Includes
  args:
    samples_jsonl: go_basic/samples.jsonl

这样这条：

jsonl
{"input": [{"role": "user", "content": "Go 中用于启动新 goroutine 的关键字是什么？"}], "ideal": "go"}

如果模型回答：

纯文本
Go 中启动 goroutine 使用 go 关键字。

Includes 更可能判对；`Match` 可能因为答案不是以 go 开头而判错。

这就是为什么评测模板的选择非常关键。

9. 更贴近你工作的例子：评测“生成 Go 单测 Agent”

假设你要评测一个 Agent 是否能生成 Go 单测，最简单 JSONL 可以这样写：

jsonl
{"input": [{"role": "system", "content": "你是 Go 测试生成助手。请只输出 Go 单元测试代码。"}, {"role": "user", "content": "为函数 Add(a, b int) int 生成单元测试。"}], "ideal": ["func TestAdd", "testing.T"]}
{"input": [{"role": "system", "content": "你是 Go 测试生成助手。请只输出 Go 单元测试代码。"}, {"role": "user", "content": "为函数 Divide(a, b int) (int, error) 生成单元测试，需要覆盖 b=0 的错误分支。"}], "ideal": ["b == 0", "error", "testing.T"]}

但这里要注意：如果你用 Includes，它只会判断是否包含某个字符串，不会判断测试是否真的可编译、覆盖率是否真的提升。

所以这只是第一层 eval：

纯文本
是否包含关键结构

更严肃的 eval 应该进一步做：

纯文本
生成代码
  ↓
写入 *_test.go
  ↓
go test ./...
  ↓
统计 coverage
  ↓
判断是否通过

这个时候就不适合只靠基础 YAML 模板了，要做 custom eval 或外部 harness。

10. 你当前理解的精确版本

你现在可以这样记：

纯文本
最简单的 OpenAI Evals =
1. 写 JSONL：每行一个测试样本
2. 每个样本至少有 input 和 ideal
3. 写 YAML：注册 eval 名字、版本、指标、评测类、数据路径
4. 用 oaieval <model> <eval_name> 运行
5. 看 accuracy 和日志

但再补一句：

纯文本
真正决定 eval 是否有价值的，不是 YAML 写对了，
而是：
- input 是否代表真实场景
- ideal 是否定义了正确行为
- class/template 是否匹配判断方式
11. 最小可复制模板
samples.jsonl
jsonl
{"input": [{"role": "user", "content": "Go 中启动 goroutine 的关键字是什么？"}], "ideal": "go"}
{"input": [{"role": "user", "content": "Redis 常见的数据结构中，哪个结构适合实现排行榜？"}], "ideal": ["zset", "sorted set", "有序集合"]}
{"input": [{"role": "user", "content": "HTTP 429 通常表示什么？"}], "ideal": ["too many requests", "请求过多", "限流"]}
go_backend_basic.yaml
YAML
go-backend-basic:
  id: go-backend-basic.dev.v0
  description: Evaluate basic Go backend knowledge with short-answer questions.
  metrics: [accuracy]

go-backend-basic.dev.v0:
  class: evals.elsuite.basic.includes:Includes
  args:
    samples_jsonl: go_backend_basic/samples.jsonl
运行
Bash
oaieval <MODEL> go-backend-basic
12. 最重要的提醒

你不要把 ideal 理解成“完整标准答案”。

在基础 eval 里，它更像：

纯文本
能判定正确的关键答案 / 参考答案

例如：

jsonl
{"input": [{"role": "user", "content": "HTTP 429 通常表示什么？"}], "ideal": ["too many requests", "请求过多", "限流"]}

只要模型回答里包含这些表达之一，就可以认为通过。

但如果你想判断：

纯文本
解释是否完整
有没有误导
是否覆盖边界
是否符合业务标准

那就不要用最简单的 Includes，而应该使用 model-graded eval 或 custom eval。

今日推荐：Google Agent Development Kit（Go 版）

如果考虑你的背景（Go 后端 + AI Agent + 工程化 + 求职 AI Backend），我认为它比再学习一个新的 Agent Framework（如 CrewAI、AutoGen）更值得投入。

原因很简单：

它代表的是"生产级 Agent 工程"，而不是"Agent Demo"。

1. 项目/资源

项目名称

Google Agent Development Kit（ADK）- Go

组织

Google

官方资源

ADK Go GitHub
ADK 官方文档

主要语言

Go（推荐）
Python（功能最完整）
Java、JavaScript、.NET
活跃度与可信度

截至近期：

Go 仓库约 8k Stars
Python 仓库约 19.9k Stars
Go 最新版本 v1.3.0（2026-05）
Python 最新版本 v2.1.0（2026-05）
官方持续维护，并已发布 ADK 2.0，引入 Graph Workflow、Dynamic Workflow、Collaborative Workflow 等能力。
GitHub
+2
2. 一句话说明它解决的真实工程问题

如何像开发普通 Go 服务一样，开发、测试、评估、部署和运维生产级 AI Agent，而不是把所有逻辑塞进一个 Prompt。

3. 为什么此刻值得学

过去几个月，你已经学习了：

Prompt Engineering
Promptfoo
OpenAI Evals
OpenTelemetry
Temporal
MCP
A2A

这些都是 AI Agent 的基础设施。

ADK 的价值在于：

把这些能力真正组织成一个可维护的 Agent 工程。

例如，你未来想做的：

纯文本
GitLab MR
      │
      ▼
Review Agent
      │
      ├── Test Agent
      ├── Security Agent
      ├── Coverage Agent
      └── Documentation Agent

ADK 官方就是围绕这种多 Agent、可编排、可评测、可部署的工程实践设计的，而不是只提供一个 agent.run()。
GitHub
+1

4. 核心精华
（1）Code-first，而不是 Prompt-first

ADK 官方一直强调：

Code-first development

Agent：

Tool
Workflow
State
Memory
Evaluation

全部写成 Go/Python 代码。

而不是：

纯文本
prompt.md

越来越大。

这意味着：

更容易测试
更容易 Code Review
更容易版本管理
（2）Workflow 是一等公民

ADK 2.0 增加了：

Graph Workflow
Dynamic Workflow
Collaborative Workflow
Agent Development Kit

例如：

纯文本
Planner
      │
      ├── Tool A
      ├── Tool B
      └── Tool C
            │
            ▼
      Aggregator

Workflow 不再只是 while(true)。

（3）Multi-Agent 不是插件，而是架构

很多框架：

Python
agent.call(other_agent)

结束。

ADK：

强调：

纯文本
Coordinator

↓

Sub Agents

↓

Shared State

↓

Workflow

这是企业真正使用 Multi-Agent 的方式。

（4）Evaluation 是框架内能力

ADK 官方定位就是：

build、evaluate、deploy AI agents。
GitHub
+1

这与你最近学习的 Promptfoo、OpenAI Evals 是天然衔接的。

以后：

纯文本
Agent
      ↓
Eval
      ↓
Regression
      ↓
Deploy

可以形成完整闭环。

（5）Go 非常适合 Agent Backend

Go 版 ADK 不是 Python 的简单移植。

官方强调：

Idiomatic Go
并发能力
Cloud Native
多 Agent
Tool 系统
可部署到 Cloud Run 等云环境
GitHub

对于你的目标岗位（AI Backend），这是明显加分项。

5. 30～60 分钟学习路线
第 1 阶段（10 分钟）

阅读：

ADK Go README

重点回答：

ADK 与 LangGraph、CrewAI 最大区别是什么？

第 2 阶段（15 分钟）

阅读：

官方文档：

Workflows

重点理解：

Graph Workflow
Dynamic Workflow
Collaborative Workflow
Agent Development Kit
第 3 阶段（15 分钟）

阅读：

samples/（Go 示例）

重点观察：

Agent 定义
Tool 注册
Workflow 编排

不要急着运行。

先看结构。

第 4 阶段（20 分钟）

阅读：

Evaluation 相关文档。

思考：

如果你的：

纯文本
自动生成测试 Agent

迁入 ADK。

哪些地方：

可以：

Eval
Trace
Retry
Multi-Agent
6. 最小动手练习

不要直接写复杂 Agent。

今天：

写一个：

Go
ReviewAgent

要求：

拥有：

三个 Tool：

纯文本
AnalyzeDiff

GenerateTest

CommentPR

要求：

Go
type Tool interface {
    Name() string
    Execute(...)
}

不要调用模型。

只完成：

Agent + Tool + Workflow

框架。

目标：

理解：

ADK 为什么强调：

Code-first。

7. 工作迁移

你的项目几乎可以直接迁移。

AI Code Review

现在：

纯文本
Prompt
↓

Review

未来：

纯文本
Review Agent

↓

Security Tool

↓

Coverage Tool

↓

Comment Tool
自动化测试

现在：

纯文本
Generate Test

未来：

纯文本
Planner

↓

Generate

↓

Run

↓

Fix

↓

Retry

↓

Report
CI Agent

以后：

纯文本
MR

↓

Review

↓

Test

↓

Coverage

↓

Deploy

都可以抽象为：

Workflow。

预计投入：

理解框架：3～5 小时
第一个 Go Agent：1 天
迁入真实项目：约 1 周
8. 刻意练习问题 / 面试追问

问题：为什么生产环境越来越强调"Code-first Agent"，而不是所有逻辑都写在 Prompt 中？

一个高质量回答应覆盖：

Prompt 难以版本管理和 Code Review。
Tool、Workflow、Memory 更适合代码表达。
代码更容易测试、重构、评测（Eval）和可观测（Trace）。
多 Agent、长流程、人工介入等复杂逻辑需要明确的控制流，而不是依赖模型推理。
Prompt 仍然重要，但应成为 Agent 的一部分，而不是整个系统。
9. 风险与适用边界

ADK 并不是所有项目都适合。

不建议使用：

单个 Prompt 就能完成的一次性任务。
小型 Demo 或 Hackathon 原型。
团队尚未建立测试、评测、可观测性体系，只想快速验证想法。

更适合：

多 Agent 协同；
长生命周期 Workflow；
企业级 AI 平台；
AI Code Review、自动化测试、CI/CD Agent；
希望长期维护、演进和部署的 Agent 系统。
为什么今天推荐它

你最近已经系统学习了：

纯文本
Prompt
    ↓
Promptfoo
    ↓
OpenAI Evals
    ↓
OpenTelemetry
    ↓
Temporal
    ↓
MCP
    ↓
A2A

我认为下一步不要再继续收集零散概念，而是开始学习一个能够把这些能力组织起来的工程框架。

对于你的目标（Go 后端 → AI Backend），**Google ADK（Go）**是目前最值得投入的候选之一：它既符合 Go 工程实践，又覆盖 Agent 的构建、评测、编排和部署，能够帮助你把之前学到的组件真正串联成完整系统。

8月12日周三 8:03
GitHub 精选
