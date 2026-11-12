---
id: openai-anthropic-protocol
type: 场景题
difficulty: hard
tags: [协议转换, OpenAI, Anthropic]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
openai authropic 协议转换遇到什么问题？

## 回答
OpenAI 和 Anthropic（Claude）的 API 协议转换，乍看只是字段映射，但真正动手做 LLM Gateway 时，你会发现：JSON 转换反而是最简单的，难点在于 Tool Calling、SSE 流式事件、Thinking 和 Agent 多轮调用的语义兼容。

结合你之前做过的 LLM 网关维护，以及正在补充的 AI Backend 工程经验，我建议你重点理解这几个问题。它们不仅是网关开发中真实会遇到的技术难点，也很适合在高级后端面试中展开。

先明确两个方向：

Anthropic → OpenAI：例如 Claude Code 使用 Anthropic SDK，通过网关调用 OpenAI 兼容模型。

OpenAI → Anthropic：例如 OpenAI SDK 通过网关调用 Claude Messages API。

这两个方向并不完全对称。尤其涉及模型特有能力时，很难做到 100% 无损转换。

一、协议转换常见的 10 类问题

问题

	

典型现象

	

难度




1. 消息结构差异

	

system、tool、content 映射错误

	

中




2. Tool Calling

	

工具调用 ID 丢失、多工具并发错乱

	

高




3. SSE 流式协议

	

普通聊天正常，流式工具调用失败

	

很高




4. Thinking / Reasoning

	

思考块丢失、签名不兼容

	

很高




5. Stop Reason

	

Agent 不知道应该继续还是结束

	

高




6. 多模态数据

	

图片、PDF、音频输入不兼容

	

高




7. Token Usage

	

缓存 Token、计费统计不准确

	

中




8. 参数兼容性

	

max_tokens、temperature、JSON Schema 报错

	

中




9. 错误码与重试

	

429/529 处理错误、重试风暴

	

高




10. 模型特有能力

	

Prompt Caching、内置工具无法映射

	

很高

这里最值得你重点研究的是 Tool Calling、SSE、Thinking 和 Stop Reason。

因为普通聊天只要能正确返回文本，看起来就像协议转换成功了。但对于 Claude Code 这样的 Agent，任何一个工具调用事件处理错误，都可能直接让整个任务中断。

二、具体会遇到什么问题，怎么解决？
1. 消息结构不一致

先看最基础的区别。

OpenAI Chat Completions：

JSON
{
  "messages": [
    {"role": "system", "content": "你是助手"},
    {"role": "user", "content": "你好"}
  ]
}

Anthropic Messages API：

JSON
{
  "system": "你是助手",
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "max_tokens": 1024
}

表面上只是 system 字段的位置不同，但实际还有不少差异：

Anthropic 把系统指令放在顶层 system。

Anthropic 的 content 可以包含多个类型化内容块。

OpenAI Chat Completions 有独立的 tool role；Anthropic 使用 tool_use 和 tool_result 内容块。

OpenAI Responses API 还引入了另一套 typed Items 结构。

如果只是写一个简单代理，可以直接做字段转换。但要支持多个模型提供商，我更建议你设计一套网关内部统一消息模型。

这样各个 Adapter 只负责把外部协议转换为内部语义结构，不需要为每两种协议单独维护转换代码。

2. Tool Calling：最容易暴露兼容性问题

这个部分建议你真正理解透。

OpenAI Chat Completions

JSON
{
  "role": "assistant",
  "tool_calls": [{
    "id": "call_123",
    "type": "function",
    "function": {
      "name": "get_weather",
      "arguments": "{\"city\":\"Beijing\"}"
    }
  }]
}

协议转换

Anthropic Messages

JSON
{
  "role": "assistant",
  "content": [{
    "type": "tool_use",
    "id": "call_123",
    "name": "get_weather",
    "input": {"city": "Beijing"}
  }]
}

你会发现，同样是调用 get_weather，两套协议的数据结构并不一样。

主要有五个问题：

OpenAI Chat Completions 的 arguments 是 JSON 字符串，而 Anthropic 的 input 是 JSON 对象。

Tool Call ID 必须与后续的工具结果正确关联。

一个 assistant 消息可能同时包含普通文本和多个工具调用。

在 SSE 场景下，工具参数可能分多次返回，中间并不是完整 JSON。

不同模型对 JSON Schema、工具选择和并行调用的支持程度不同。

举个实际会遇到的故障。

假设上游正在流式输出工具参数：

纯文本
chunk1: {"city":
chunk2: "Beijing"
chunk3: }

如果你的网关对每个 Chunk 直接执行：

Go
json.Unmarshal(chunk, &args)

就可能得到：

纯文本
unexpected end of JSON input

但这不一定是模型输出错误，而是你在 JSON 尚未生成完整时就尝试解析了。

正确的工程方案： 按工具调用 ID 和 stream index 维护独立缓冲区，累积工具参数，等收到参数完成事件后再校验 JSON。

同时需要保留多个工具调用之间的 ID、顺序和关联关系。
OpenAI API
+1

3. SSE 流式协议：不是把 Chunk 转成 JSON 就行

这是我认为你做 Go 网关时最值得深入的部分。

OpenAI Chat Completions：

纯文本
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: [DONE]

Anthropic：

纯文本
event: message_start
data: {...}

event: content_block_start
data: {...}

event: content_block_delta
data: {...}

event: content_block_stop
data: {...}

event: message_delta
data: {...}

event: message_stop
data: {...}

两者都是基于 SSE，但事件结构和生命周期完全不同。

而 OpenAI Responses API 还有 response.output_text.delta、response.function_call_arguments.delta、response.completed 等事件。
OpenAI API
+2

你需要特别关注三个工程问题。

问题一：网络 Chunk 不等于 SSE Event。

一次 TCP 读取可能只读到半个事件，也可能同时读到多个事件。

所以不能认为一次 Read() 就对应一个完整 JSON。

问题二：流式 Tool Calling 需要状态机。

例如上游不断返回工具参数片段，网关不仅要把它们拼起来，还要知道：

当前属于哪个工具调用？

当前 Content Block 是否已经开始？

什么时候结束这个 Block？

多个工具调用是否需要分别维护状态？

上游完成后应该向客户端发送什么结束事件？

这些都不是简单 for 循环转发字符串能够可靠解决的。

问题三：流式输出中途失败怎么办？

假设模型已经返回了部分内容，上游突然超时。

此时 HTTP 200 响应头可能已经发送出去，你无法再修改成 HTTP 500。

因此需要：

通过目标协议支持的流内错误事件报告异常。

终止流，而不是伪造正常结束。

避免整个请求被自动重试，导致文本重复。

特别注意 Tool Calling，防止工具被重复执行。

这也解释了为什么一个成熟的 LLM Gateway，需要专门的流式状态机，而不只是 SSE 透传。

4. Thinking / Reasoning：不能简单互相映射

如果你准备让 Claude Code 通过网关调用其他模型，这个问题需要格外关注。

Anthropic 支持 thinking、redacted_thinking、signature 等结构，而 OpenAI Responses 使用 reasoning Item 等结构。

它们并没有完整的一一对应关系。

例如 Anthropic 可能返回：

JSON
{
  "type": "thinking",
  "thinking": "...",
  "signature": "opaque-signature"
}

这里的 signature 不是一个可以随便生成的字符串。

在部分多轮 Tool Calling 场景下，Anthropic 要求原样传回原始 Thinking Block。如果中间网关把它过滤、修改或者重新组织，可能收到 HTTP 400。
Claude Platform Docs
+1

实际设计时，我建议遵循以下原则：

同一个提供商的原生 Thinking 内容，尽可能原样保留。

跨提供商时，只转换明确兼容的字段。

不支持的 Thinking 签名，不能自行伪造。

对需要保留思考上下文的多轮调用，要提前判断目标协议是否支持。

所以，支持 Anthropic API 格式，不意味着就能完整模拟 Claude 模型的全部行为。

5. Stop Reason：映射错误会导致 Agent 直接终止

这个问题很容易被低估。

Anthropic

	

OpenAI Chat Completions

	

语义




end_turn

	

stop

	

正常结束




tool_use

	

tool_calls

	

等待调用工具




max_tokens

	

length

	

达到输出限制




stop_sequence

	

通常映射为 stop

	

命中停止序列




pause_turn

	

无直接等价项

	

当前轮次暂停




refusal

	

需结合拒绝信息处理

	

拒绝回答

这些是语义上的近似映射，不是完全相同的协议字段。
Claude Platform Docs

例如，你把 Anthropic 的 tool_use 错误映射成 OpenAI 的 stop，客户端就可能认为模型已经回答完毕，不再执行后续工具调用。

对于普通聊天，这可能表现为一次输出异常；但对于 Agent，可能直接导致整个任务提前结束。

6. 其他生产环境经常遇到的问题

除了前面几个核心难点，还有一些问题容易在接入更多模型后逐渐暴露：

参数转换： max_tokens、max_completion_tokens、thinking、reasoning_effort 不能一律直接替换，需要结合目标模型的能力进行校验。

Token 统计： Input、Output、Cache Read、Cache Write 需要区分，否则可能导致账单统计不准确。

多模态： 图片、文件、音频以及内置工具并不是所有提供商都支持。无法转换时应该明确报错，不能静默丢弃。

错误处理： 429、529、上游超时等需要分类处理，重试要有指数退避、jitter 和总预算，避免产生重试风暴。

取消传播： 如果客户端取消生成，Go 网关应通过 context.Context 向上游传递取消信号，避免继续产生推理费用。

三、如果你用 Go 开发协议转换网关，建议这样设计

我不建议把所有转换逻辑都写到一个 HTTP Handler 里面。

更适合长期维护的方式是：Adapter + Canonical Model + Stream State Machine + Capability Negotiation。

Client / Agent

Claude Code · OpenAI SDK · 自研 Agent

Anthropic Adapter

Messages / SSE

OpenAI Adapter

Chat / Responses

Canonical Internal Model（统一语义模型）

Message / Content Block

Tool Call / Result

Stream Event / State

Usage / Stop Reason

Capability Negotiation + Routing

模型能力校验 · 参数适配 · 错误处理

OpenAI

Anthropic

其他模型

内部模型可以先从这样的结构开始：

Go
type ContentBlock struct {
    Type    string
    Text    string
    ToolID  string
    Name    string
    Input   json.RawMessage

    // 保留无法通用映射的原生数据
    ProviderMetadata json.RawMessage
}

type Message struct {
    Role    string
    Content []ContentBlock
}

不过这只是消息结构的最小示例，还不够支撑完整协议兼容。你还需要分别定义 Stream Event、Tool Call State、Usage、Stop Reason 和 Capability。

具体工程上，我建议你抓住四条原则：

1. Adapter 负责协议，Router 负责选模型。 让协议转换和模型路由解耦，避免后续新增模型时不断修改核心代码。

2. SSE 转换必须使用状态机。 明确维护内容块索引、消息状态、工具 ID、参数缓冲区以及结束原因。

3. 允许能力降级，但不能静默丢失重要语义。 例如不支持原生 Thinking 签名时，不能为了兼容而自行伪造。

4. 测试不能只覆盖普通聊天。 最好保留真实的请求、响应和 SSE 事件序列，做 Golden Test 和 E2E Test，重点覆盖多工具调用、Thinking、流中断、取消和长对话。

四、面试官问：OpenAI 与 Anthropic 协议转换遇到了哪些技术难点？

结合你高级 Go 后端、AI Backend 的求职方向，我建议你把回答组织成下面这样，既能说明协议原理，也能体现工程思考。

写作

协议转换最初看起来只是 OpenAI 和 Anthropic 的 JSON 字段映射，但深入分析后，我认为真正的复杂度主要集中在三个方面。

第一是消息语义不同。 比如 OpenAI 的 Tool Call 和 Anthropic 的 tool_use、tool_result 结构不同，需要维护工具调用 ID、参数和工具结果之间的关联，保证多轮 Agent 调用不会出现上下文错乱。

第二是流式协议不同。 虽然两者都基于 SSE，但事件生命周期和增量数据结构不同。尤其在流式 Tool Calling 场景下，工具参数可能分多个 Chunk 返回，因此不能简单地逐条做 JSON 转换，而需要通过状态机完成增量解析和事件重组。

第三是模型能力不完全兼容。 比如 Thinking、Prompt Caching、Stop Reason 以及 Token Usage 的定义都有差异。所以协议转换不仅要考虑格式，还需要考虑语义是否等价，以及目标模型是否具备对应能力。

从架构设计上，我倾向于使用 Adapter + 统一内部消息模型的方案，把协议转换和模型路由解耦，同时通过流式事件回放、多轮 Tool Calling 测试以及异常场景测试来保证正确性。

这里需要注意：这段更适合作为你的技术分析和设计思路。如果面试官追问“你实际遇到了哪种故障、怎么定位、最终改了什么代码”，就必须结合你真实做过的网关工作回答，不能把设计方案说成已经上线的成果。

五、我建议你再深入一个真实工程场景

假设你现在有这样一个调用链：

纯文本
Claude Code
    |
    | Anthropic Messages API
    v
Go LLM Gateway
    |
    | OpenAI Chat Completions API
    v
上游模型

普通聊天一切正常，但 Claude Code 一旦开始调用 Read、Edit、Bash 等工具，就出现以下情况：

工具参数 JSON 解析失败；

工具已经调用，但结果无法正确回传；

模型明明要求调用工具，Claude Code 却认为任务结束；

SSE 返回了部分内容后突然中断。

你可以按照这条链路排查：

请求转换：工具定义、消息角色、参数是否正确？

上游模型返回：是否生成了合法的 Tool Call？

SSE 解析：是否处理了事件分片和多事件读取？

Tool Call 重组：参数是否完整，ID 是否保持一致？

Stop Reason 映射：是否把工具调用错误映射成正常结束？

工具结果回传：下一轮请求是否保留了正确的上下文和调用关联？

对你而言，最值得掌握的不只是“协议字段怎么转”，而是“为什么普通请求成功，Agent 多轮工具调用却会失败”。

这个问题能把 Go 流式处理、状态机、JSON 增量解析、上下文取消、异常恢复和 Agent 执行机制串联起来，也更接近真实的 AI Backend 工程难点。
