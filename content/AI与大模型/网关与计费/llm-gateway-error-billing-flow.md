---
id: llm-gateway-error-billing-flow
type: 场景题
difficulty: hard
tags: [网关, 错误处理, 计费]
sources: [gemini]
date: 2026-11-12
---

## 题目
关于大模型网关，1. 上游大模型的错误怎么处理 2. 不同模型计费 比如openai和authropic 输入都叫prompt 但是他们有什么本质的不同吗 3.从用户输入到返回 大模型都有哪些内容 流经的流程有哪些 4. 如何保证计费和大模型厂商的计算精确一致 5. 上游大模型厂商遇到的中断类型都有哪些 6. 限流有哪些类型 怎么做 7. 接了哪些大模型 他们协议兼容具体有哪些

## 回答
针对你提出的 7 个关于大模型网关（如 sub2api、NewAPI、LiteLLM）的核心架构与设计问题，我们逐一进行深度剖析：

1. 上游大模型的错误怎么处理？

大模型上游（OpenAI、Anthropic、DeepSeek、vLLM 等）经常会返回各种异常。网关不能直接把原始错误抛给用户，需要做分类处理与容灾策略：

错误分类与应对策略：

429 Too Many Requests（限流/超载）：触发轮询重试（Retry）或自动故障转移（Failover / Load Balancing）。如果当前 Channel 满载，网关立即将请求无缝切换到备用 Channel（如备用 API Key 或备用供应商）。

500 / 502 / 503 / 504（上游服务器崩溃或超时）：同上，触发重试与 Failover。若所有备用通道均不可用，则向客户端返回标准的错误码，并附带友好的错误提示。

400 Bad Request（参数错误/内容安全拦截）：此类错误通常是由于用户请求体不合法或触发了上游的内容安全审核（Content Moderation），不应重试，应原封不动透传给客户端，方便客户端调试。

重试与退避机制：采用指数退避（Exponential Backoff）+ 随机抖动（Jitter），避免重试风暴（Retry Storm）彻底压垮上游。

流式传输中途断开（Stream Interruption）：如果 SSE 流传输到一半上游断开，网关需要捕获该异常，若已输出部分内容，则在流末尾追加一个特殊的错误标识或直接关闭连接，并根据已传输的 Token 数进行阶段性精准计费，避免多扣或漏扣。

2. 不同模型计费（如 OpenAI 和 Anthropic），输入都叫 prompt，有什么本质不同吗？

虽然在请求体中它们都叫 prompt 或 messages，但在底层 Token 计算、计费维度和高级特性上有本质区别：

分词器（Tokenizer）与 Token 消耗差异：

OpenAI 使用 Tiktoken（如 cl100k_base、o200k_base），Anthropic 使用其专属的 Claude Tokenizer。同样的中文或代码段，两者的 Token 计数可能相差 15%~30% 左右。因此网关在做本地预估时，必须针对不同模型加载对应的分词逻辑。

计费维度的演进（缓存计费）：   
PE Collective

Anthropic (Claude) 极大地普及了 Prompt Caching（提示词缓存） 机制。如果请求中包含大段稳定的系统提示词或长文档，Anthropic 会对“缓存命中（Cache Read）”的 Token 收取极低的分（通常是原输入价的 10%），而对“缓存写入（Cache Write）”收取略高的溢价。

OpenAI 则拥有自动缓存机制（Automatic Prompt Caching），但计费规则和透传字段与 Anthropic 各异。   
PE Collective

网关应对方案：网关在配置模型费率表时，不能仅仅配置简单的 input_price 和 output_price，还需要兼容各家厂商特殊的计费字段（如 cache_read_input_tokens、cache_creation_input_tokens），在解析上游返回的 usage 时动态计算复合成本。

3. 从用户输入到返回，大模型网关流经的流程有哪些？

一个典型的生产级大模型网关，请求会经历以下全生命周期流程：

[Client 客户端] 
   │
   ▼
1. 接入层 (Nginx/Traefik/Cloudflare)
   │
   ▼
2. 网关核心层：鉴权、API Key 校验、路由匹配、多租户限流 (Rate Limiting)
   │
   ▼
3. 预处理与计费层：本地 Tokenizer 计算、Redis Lua 脚本原子预扣费 (Pre-consumption)
   │
   ▼
4. 策略与调度层：模型映射 (Model Mapping)、负载均衡 (Load Balancing)、Channel 轮询/重试
   │
   ▼
5. 转发与代理层 (Proxy & SSE Stream)：向大模型 Provider 发起 HTTP/2 请求并透传响应
   │
   ▼
6. 后置结算与异步落盘：解析官方 usage 或实时计算、多退少补、MQ 异步写日志/账单 (ClickHouse)
   │
[Client 客户端收到完整响应]

4. 如何保证计费和大模型厂商的计算精确一致？

由于大模型涉及流式动态生成，要做到绝对精确一致非常困难，业界通用的做法是“官方数据为主、本地估算为辅、动态对账纠偏”：

首选官方 usage 闭环：

OpenAI 在流式请求中支持开启 stream_options: {"include_usage": true}。请求的最后一个 Chunk 会携带官方精确的 prompt_tokens 和 completion_tokens。

Anthropic 等厂商的 SSE 响应流尾帧也会带上精确的 usage。网关一旦捕获到该字段，直接以官方为准进行结算。

兜底计算（Fallback）：

如果某些旧模型或非标准上游在流式响应中不返回 usage，网关会在内存中拼接完整的输出文本，使用对应的 Tokenizer 重新计算，以此作为实际消费。

预扣与补结算机制（Pre & Post Settlement）：

采用前文提到的“预扣最大可能消耗（Pre-deduction） 
→
→ 拿到真实 Usage 
→
→ 差额多退少补（Settlement）”。

定期对账与容错：

网关异步留存每一笔请求的原始 usage 日志，定期与大模型厂商后台的账单进行抽样对账。

5. 上游大模型厂商遇到的中断类型都有哪些？

在调用上游大模型时，网关经常会遇到以下几类中断：

传输层中断（Network / Transport Disconnection）：

TCP 连接突然被重置（Connection Reset by Peer）、底层 SSL/TLS 握手失败、DNS 解析超时。   
Authgear

HTTP 协议层状态码中断：

429 Too Many Requests（触发限流）

500 Internal Server Error（厂商服务器内部错误）

502 Bad Gateway / 504 Gateway Timeout（上游网关或代理超时）

503 Service Unavailable（厂商过载或停机维护）

大模型业务层/流中途中断（Stream-Level Abort）：

Chunk 超时挂起：连接建立后正常输出了几个 Token，但随后长时间（例如超过 30 秒）没有任何新的 SSE Chunk 下发（俗称“卡死”）。

超长截断（Max Tokens Cut-off）：模型因达到了请求指定的 max_tokens 上限而主动停止，finish_reason 变为 length。

内容安全强行中断：模型在生成到一半时触发了安全审核红线，强行中断输出并返回安全违规报错。

6. 限流有哪些类型？怎么做？

大模型网关的限流比传统 Web 更加复杂，通常需要多维度的限流策略：

限流的维度：

RPM（Requests Per Minute）：每分钟请求数（防刷）。

TPM（Tokens Per Minute）：每分钟 Token 消耗数（大模型特有，防止高并发长文本瞬间打爆上游配额）。

并发数（Concurrency）：当前正在进行的流式请求数。

主流算法与实现：

令牌桶算法（Token Bucket）：非常适合大模型网关，允许一定的突发流量（Burst），同时通过固定速率补充令牌。   
Maxim AI

滑动窗口计数器（Sliding Window）：结合 Redis 的 Sorted Set（ZSET）或 Redis 6+ 的 Redis-Cell 模块，精准控制 TPM。

分布式网关怎么做：

必须依托 Redis Cluster。利用 Redis 的原子操作或 Lua 脚本，在分布式集群中共享用户的 TPM/RPM 状态。如果 Redis 宕机，网关通常会设计降级策略（如走本地内存的轻量级限流或直接放行，保障可用性）。

7. 接了哪些大模型？协议兼容具体有哪些？

成熟的大模型网关（如 LiteLLM、NewAPI）通常通过适配器模式（Adapter Pattern）屏蔽底层差异：   
Requesty

已接入的主流大模型家族：

OpenAI（GPT-4o, o1, o3, DALL-E等）   
PE Collective

Anthropic（Claude 3.5 Sonnet / Opus 等）

Google Gemini（Gemini 1.5 Pro/Flash 等）

开源本地模型（通过 vLLM、Ollama 部署的 Llama 3、DeepSeek-R1、Qwen 等）

协议兼容的核心痛点与具体做法：

统一出口（OpenAI-Compatible API）：网关对外统一暴露兼容 OpenAI /v1/chat/completions 的标准接口。无论客户端发来的是什么请求，网关内部的 Adapter 都会将其转换为目标厂商的专属协议。

协议转换的具体差异：

Anthropic 协议转换：Anthropic 的 API 接口格式与 OpenAI 差异较大（例如它的 System Prompt 是顶层字段，而不是放在 messages 数组里；工具调用 tools 的 JSON Schema 格式也完全不同）。网关的 Anthropic Adapter 负责在接收到 OpenAI 格式请求后，将其动态转换成 Anthropic 的 /v1/messages 格式，并在响应时把 Anthropic 的流式事件（如 content_block_delta）反向转换为 OpenAI 的 SSE Delta 格式。

Gemini 协议转换：Google Gemini 的多模态输入（图片、视频）和结构化输出参数与 OpenAI 存在字段映射差异，网关需要做参数清洗与重映射。
