---
id: function-calling-principle
type: 概念题
difficulty: medium
tags: [FunctionCalling, 工具调用]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
function calling 中的func 是用户自定义的吗 如果是的话 又不是不模型推理 如果又是在本地执行的话 为什么还需要花钱 function calling应该是应该是agent调用的吧（比如 chatgpt）而不是大模型来调用的

## 回答
对，你的理解已经接近本质了，但有一个关键点要纠正：

Function Calling 不是“模型在你的机器上执行函数”。

它本质上是：模型判断“该调用哪个函数，并生成函数名 + 参数”；真正的函数执行由你的应用/Agent runtime 完成。

OpenAI 官方也是这样定义的：模型返回 tool call，请求你的应用执行对应函数；应用执行后再把结果发回模型。
OpenAI Developers
+1

先看完整流程

假设你自己定义：

Go
func GetWeather(city string) Weather {
    // 调天气 API
}

你不会把 Go 代码本身交给模型。

你告诉模型的只是一个类似这样的接口描述：

JSON
{
  "name": "get_weather",
  "description": "查询城市天气",
  "parameters": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string"
      }
    }
  }
}

然后用户说：

纯文本
北京今天多少度？

模型推理后，不一定直接回答文字，而可能输出：

JSON
{
  "name": "get_weather",
  "arguments": {
    "city": "北京"
  }
}

注意，到这里：

模型没有执行 GetWeather()。

它只是产生了一个：

“请调用 get_weather(city="北京")”

这样的结构化决策。

然后你的 Agent / Backend 做：

纯文本
收到 tool_call
      ↓
找到本地 GetWeather
      ↓
GetWeather("北京")
      ↓
得到 27°C

最后再把：

JSON
{
  "temperature": 27
}

送回模型。

模型才生成：

纯文本
北京今天约 27°C。

官方描述的标准流程正是：

应用把可用 tools 发给模型
模型产生 tool call
应用执行代码
把 tool output 发回模型
模型继续生成最终回答。
OpenAI Developers
那为什么 Function Calling 还需要花钱？

因为收费的并不是：

GetWeather() 这个函数执行。

而是前后发生的 LLM inference。

你可以把整个链路拆成两类计算：

纯文本
                    谁执行               是否产生模型费用

理解用户问题        LLM                   是
判断需不需要工具      LLM                   是
选择哪个工具          LLM                   是
生成工具参数          LLM                   是

执行 GetWeather      你的服务器              否*
查 MySQL             你的服务器              否*
调用 Kubernetes API  你的服务器              否*

理解工具返回结果       LLM                   是
组织最终答案           LLM                   是

* 当然你自己的服务器、第三方 API 可能也有成本，但不是 OpenAI token 费用。

所以 Function Calling 的典型链路实际上可能发生 两次模型调用：

纯文本
User
 │
 ▼
LLM inference #1
 │
 │ “需要 get_weather(city=北京)”
 ▼
Agent Runtime
 │
 ▼
本地函数 / API
 │
 │ 27°C
 ▼
LLM inference #2
 │
 ▼
最终回答

你付费主要是：

纯文本
LLM inference #1
+
LLM inference #2

而不是：

纯文本
GetWeather()
你第二个问题更关键：到底是 Agent 调，还是模型调？

最严谨的说法是：

模型决定调用，Agent 执行调用。

这两个不要混为一谈。

可以分为三个角色：

纯文本
User
  ↓
Agent Runtime
  ↓
LLM

其中：

LLM

负责：

纯文本
理解意图
推理
选择 tool
生成 arguments
分析 tool result
决定下一步
Agent Runtime

负责：

纯文本
维护循环
管理上下文
真正执行 tool
权限控制
timeout
retry
并发
状态
日志
Tool

负责：

纯文本
真正干活

比如：

纯文本
search_database()
kubectl_get_pods()
create_ticket()
send_email()
get_weather()

所以完整架构更准确是：

纯文本
               ┌──────────── LLM ────────────┐
               │                             │
               │ “我要调用 get_weather”      │
               │ city = Beijing              │
               │                             │
               └─────────────┬───────────────┘
                             │ tool_call
                             ▼
                    Agent Runtime
                             │
                       dispatch tool
                             ▼
                       get_weather()
                             │
                         27°C
                             ▼
                    Agent Runtime
                             │
                      tool_output
                             ▼
                            LLM
                             │
                         最终回答
那 ChatGPT 属于什么？

这里你的理解也基本正确：

ChatGPT 不是单纯的“大模型”。

它更像：

纯文本
ChatGPT Product
     │
     ├── UI
     │
     ├── Agent / Runtime
     │
     ├── Models
     │
     ├── Tools
     │    ├ web
     │    ├ code
     │    ├ files
     │    └ connectors
     │
     ├── Context management
     ├── permissions
     └── orchestration

比如你问 ChatGPT：

纯文本
帮我查北京天气

抽象来看可能发生：

纯文本
ChatGPT Agent Runtime
        ↓
       LLM
        ↓
模型判断：需要 weather tool
        ↓
Agent Runtime 调 weather
        ↓
weather result
        ↓
LLM
        ↓
回答你

所以口语里人们经常说：

“GPT 调了一个工具。”

这是一种简写。

工程上更准确：

模型生成 tool call；Agent runtime 根据这个 tool call 真正执行工具。

为什么名字叫 Function Calling，容易让人误解？

确实很容易误解。

看到：

纯文本
Function Calling

很容易认为：

纯文本
LLM
 ↓
直接调用 Go/Python function

实际上更像：

纯文本
LLM
 ↓
生成一个 RPC / command 描述
 ↓
你的程序执行

甚至你可以把它类比成 RPC。

模型输出：

JSON
{
  "method": "get_weather",
  "params": {
    "city": "Beijing"
  }
}

你的 Agent 相当于：

Go
switch call.Name {
case "get_weather":
    result := GetWeather(call.Arguments.City)
}

这个类比对后端开发者尤其好理解。

那既然是 Agent 调函数，为什么还需要 Function Calling？

因为传统程序很容易写：

Go
if request.Path == "/weather" {
    GetWeather(city)
}

但自然语言不是确定性的 API。

用户可能说：

纯文本
北京热不热？

也可能说：

纯文本
今天北京出门要不要穿外套？

也可能说：

纯文本
我今晚去北京，帮我看看温度。

你总不能自己写：

Go
if strings.Contains(input, "天气") ...

Function Calling 解决的正是：

纯文本
Natural Language

      ↓

LLM semantic reasoning

      ↓

Structured Function Call

比如：

纯文本
“北京今天出门要穿外套吗？”

        ↓ LLM

先调用：
get_weather(city="北京")

        ↓

10°C

        ↓ LLM

“建议带一件外套。”

所以 LLM 本质上承担的是：

Natural Language → structured action decision

这才是 Function Calling 最核心的价值。

这就是 Agent 为什么需要 LLM

传统程序：

纯文本
workflow 由程序员写死

例如：

Go
weather := GetWeather()
if weather.Temp < 10 {
    ...
}

Agent：

纯文本
workflow 部分由模型运行时决定

例如用户：

纯文本
为什么线上 P99 突然升高？

模型可能决定：

纯文本
先：
get_pods()

发现某 pod CPU 高

再：
get_metrics(pod)

发现 CPU 100%

再：
get_logs(pod)

发现大量 timeout

再：
query_downstream_latency()

发现 DB latency 上涨

你的程序根本没有写死：

纯文本
get_pods
→ get_metrics
→ get_logs
→ query DB

而是模型动态规划出来的。

于是：

纯文本
LLM = Decision Maker

Agent Runtime = Executor / Orchestrator

Tool = Capability

这三个概念建议你彻底分开。

用你的 K8s Incident Agent 来看就非常清楚

你可以提供：

纯文本
Tools

get_pods(namespace)
get_pod_metrics(pod)
get_logs(pod)
get_events(namespace)
query_prometheus(query)
describe_pod(pod)

用户：

纯文本
为什么 checkout 服务 P99 从 200ms 涨到 3s？

LLM 第一次可能返回：

纯文本
query_prometheus(
    "histogram_quantile(...)"
)

Agent Runtime：

纯文本
执行 Prometheus API

返回：

纯文本
P99 = 3s
CPU = 30%
downstream_db_latency = 2.7s

模型继续判断：

纯文本
query_prometheus(
    "db_connection_pool_wait..."
)

然后继续。

这才是真正：

纯文本
Agent Loop

LLM
 ↓
Tool Call
 ↓
Runtime Execute
 ↓
Observation
 ↓
LLM
 ↓
Tool Call
 ↓
...
最后一个特别重要的概念

你刚才说：

“又不是模型推理”

这里实际上需要改一下。

Tool 本身不是模型推理。

但：

“要不要调用 Tool、调用哪个 Tool、参数是什么、拿到结果以后下一步怎么办”

通常恰恰是模型推理的一部分。

可以记成：

纯文本
Function execution
≠
LLM reasoning

但：

纯文本
Function selection
+
Argument generation
+
Result interpretation
+
Next action decision

=
LLM reasoning

所以你以后看到：

纯文本
function calling
tool calling
agent

可以直接用这张最简模型：

纯文本
              reasoning
                 ↓
User → LLM → tool_call
              │
              ▼
        Agent Runtime
              │
              ▼
          Local Tool
              │
          observation
              ▼
             LLM
              │
          reasoning
              ▼
            Answer

这也是为什么 Function Calling 是搭 Agent 的基础机制，但 Function Calling 本身还不等于 Agent。一个真正的 Agent 往往还需要 loop、state/context、tool runtime、权限、错误处理、终止条件等。OpenAI 文档也明确区分了模型发起工具调用和应用程序实际执行工具这两个阶段。
OpenAI Developers

你现在如果把这个区别吃透，后面理解 MCP、Agent SDK、LangGraph、Tool Runtime 会一下顺很多。
