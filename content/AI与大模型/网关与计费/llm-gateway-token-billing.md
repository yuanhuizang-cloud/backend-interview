---
id: llm-gateway-token-billing
type: 场景题
difficulty: hard
tags: [网关, Token计费, 面试]
sources: [gemini]
date: 2026-11-12
---

## 题目
参考sub2api、newapi和litellm这类产品，大模型网关的token计费 一般怎么做 （python和go的分别代码示例配合讲解），然后面试时问大模型网关的难点是什么 可以怎么回答

## 回答
像 sub2api、NewAPI 以及 LiteLLM 这类大模型网关，核心作用是为上层应用提供统一的代理转发、路由鉴权、配额管控与成本核算。   
New API

大模型网关在进行 Token 计费 时，不仅要处理文本分词与价格换算，还要兼顾高并发下的数据一致性与低延时。   
New API

一、 大模型网关 Token 计费核心逻辑

网关的计费模型通常围绕以下三个阶段与计费公式展开：   
LiteLLM documentation

1. 计费核心公式

以 NewAPI 的经典公式为例，扣除的配额（Quota）并非简单地将输入与输出相加，而是加入了倍率机制：   
New API

扣费配额
=
(
Prompt Tokens
+
Completion Tokens
×
补全倍率
)
×
模型倍率
×
分组/用户倍率
扣费配额=(Prompt Tokens+Completion Tokens×补全倍率)×模型倍率×分组/用户倍率

Prompt Tokens（输入） 与 Completion Tokens（输出）：通常模型输出比输入成本高（例如 OpenAI 的输出价格通常是输入的 3 倍），因此需要设定补全倍率。   
docs.litellm.ai

模型倍率（Model Ratio）：不同模型（如 gpt-4o 与 claude-3-5-sonnet）基准价格不同。

分组倍率（Group Ratio）：用于支持 VIP 用户打折或特定渠道加价。

2. 预扣费与实扣费机制（Pre-consumption & Post-consumption）

由于 LLM 请求（尤其是 SSE 流式响应）耗时极长，网关绝对不能等请求结束才校验余额，也不能在请求刚开始就直接扣完全部余额。

步骤 1：预扣费（Pre-consumption）

接收请求后，读取请求体中的 messages 和 max_tokens。   
docs.litellm.ai

使用本地 Tokenizer 计算 Input Tokens，结合 max_tokens 预估本次最大消耗成本。   
docs.litellm.ai

在 Redis 中原子性冻结/预扣对应余额。如果余额不足，直接拒绝请求（返回 402/429）。

步骤 2：流式代理（Streaming Proxy）

转发请求给 Provider，流式透传 Chunk 给 Client。

在网关侧按 SSE 解析 Chunk 内容，拼接或实时计数 Output Tokens。   
LiteLLM documentation

步骤 3：结算与补扣/退回（Post-consumption）

首选：从上游 Provider 响应末尾的 usage 字段读取官方精准 Token 数（如 OpenAI 在 stream_options: {"include_usage": true} 时会带上 usage；Anthropic 也会在流式尾帧带上 message_delta.usage）。   
LiteLLM documentation

兜底：若上游不返回 usage，则使用网关自身的 Tokenizer 计算输出文本的 Token 数。   
LiteLLM documentation

计算实际消费，多退少补（将 Redis 中预扣多出的额度退回，或补扣超出的部分）。

二、 代码实现示例
1. Python 实现（异步 + Redis 事务/Lua 脚本）

Python 在 LiteLLM 中常用，基于 AsyncIO + Redis 实现预扣费与流式响应后的异步结算：

Python
import asyncio
import json
import tiktoken
import redis.asyncio as aioredis

# Redis 连接池
redis_client = aioredis.from_url("redis://localhost:6379", decode_responses=True)

# 简化的模型倍率表 ($/1k tokens)
MODEL_RATES = {
    "gpt-4o": {"input": 0.0025, "output": 0.0100},
    "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0150}
}

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    """使用 tiktoken 计算文本 Token 数"""
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))

async def pre_deduct_user_balance(user_id: str, estimated_cost: float) -> bool:
    """原子预扣费 (使用 Redis Lua 脚本保证原子性)"""
    lua_script = """
    local balance = tonumber(redis.call('GET', KEYS[1]) or "0")
    local cost = tonumber(ARGV[1])
    if balance >= cost then
        redis.call('DECRBYFLOAT', KEYS[1], cost)
        return 1
    else
        return 0
    end
    """
    keys = [f"user:balance:{user_id}"]
    result = await redis_client.eval(lua_script, 1, *keys, estimated_cost)
    return result == 1

async def settle_user_balance(user_id: str, estimated_cost: float, actual_cost: float):
    """结算：退回预扣多算的部分，或补扣少算的部分"""
    diff = estimated_cost - actual_cost
    if diff != 0:
        # diff > 0 代表预估偏高，退还余额；diff < 0 代表补扣
        await redis_client.incrbyfloat(f"user:balance:{user_id}", diff)

async def handle_llm_request(user_id: str, model: str, messages: list, max_tokens: int = 500):
    # 1. 计算输入 Token & 预估最大成本
    prompt_str = "".join([m["content"] for m in messages])
    input_tokens = count_tokens(prompt_str, model)
    
    rate = MODEL_RATES.get(model, MODEL_RATES["gpt-4o"])
    # 预估成本 = 输入成本 + max_tokens * 输出单价
    estimated_cost = (input_tokens / 1000 * rate["input"]) + (max_tokens / 1000 * rate["output"])

    # 2. 预扣费
    if not await pre_deduct_user_balance(user_id, estimated_cost):
        raise Exception("402 Payment Required: Insufficient balance")

    print(f"[Pre-Deduct] User {user_id} frozen: ${estimated_cost:.6f}")

    # 3. 模拟上游 LLM 流式输出与真实 Usage 获取
    actual_output_tokens = 120  # 假设实际输出了 120 个 Token
    
    # 4. 计算真实成本并结算
    actual_cost = (input_tokens / 1000 * rate["input"]) + (actual_output_tokens / 1000 * rate["output"])
    await settle_user_balance(user_id, estimated_cost, actual_cost)
    
    print(f"[Settlement] User {user_id} actual cost: ${actual_cost:.6f}, refunded/adjusted.")

2. Go 实现（高性能通道与管道化处理）

Go 在 NewAPI / sub2api 中广泛应用，强调并发效率与极致低延时：

Go
package main

import (
	"context"
	"fmt"
	"github.com/cloudwego/hertz/pkg/common/hlog"
	"github.com/go-redis/redis/v8"
	"github.com/pkoukk/tiktoken-go"
)

var ctx = context.Background()
var rdb *redis.Client

func init() {
	rdb = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
}

// CalculateTokens 使用 tiktoken 估算输入 Token
func CalculateTokens(text string, model string) int {
	tkm, err := tiktoken.EncodingForModel(model)
	if err != nil {
		tkm, _ = tiktoken.GetEncoding("cl100k_base")
	}
	tokens := tkm.Encode(text, nil, nil)
	return len(tokens)
}

// PreDeduct 扣除预估配额 (配额通常以 1 USD = 500,000 points 存储以避免浮点精度误差)
func PreDeduct(userID string, quota int64) (bool, error) {
	script := redis.NewScript(`
		local balance = tonumber(redis.call('GET', KEYS[1]) or "0")
		local quota = tonumber(ARGV[1])
		if balance >= quota then
			redis.call('DECRBY', KEYS[1], quota)
			return 1
		else
			return 0
		end
	`)
	
	res, err := script.Run(ctx, rdb, []string{"user:quota:" + userID}, quota).Int()
	if err != nil {
		return false, err
	}
	return res == 1, nil
}

// PostSettle 异步结算多退少补
func PostSettle(userID string, preQuota int64, actualQuota int64) {
	diff := preQuota - actualQuota
	if diff != 0 {
		rdb.IncrBy(ctx, "user:quota:"+userID, diff)
	}
	hlog.Infof("Settle completed for user %s, diff: %d", userID, diff)
}

func main() {
	userID := "user_123"
	model := "gpt-4o"
	prompt := "Explain LLM Gateway token billing."
	
	// 1. 本地计算输入 token
	inputTokens := int64(CalculateTokens(prompt, model))
	var maxOutputTokens int64 = 1000
	
	// 2. 换算为配额点数 (简化的预估算法)
	var modelMultiplier int64 = 15 // 模型倍率
	preQuota := (inputTokens + maxOutputTokens*2) * modelMultiplier

	// 3. 预扣费
	success, err := PreDeduct(userID, preQuota)
	if err != nil || !success {
		fmt.Println("Pre-deduct failed: Insufficient Quota")
		return
	}

	// 4. 模拟请求完成后上游返回的实际 Usage
	var actualInputTokens int64 = inputTokens
	var actualOutputTokens int64 = 250 // 实际输出 250 个 token
	actualQuota := (actualInputTokens + actualOutputTokens*2) * modelMultiplier

	// 5. 异步/后台结算
	go PostSettle(userID, preQuota, actualQuota)
}

三、 面试高频问题：大模型网关的难点是什么？如何回答？

在面试中回答此问题，建议按照 “核心挑战 
→
→ 解决方案 
→
→ 场景落地与工程权衡” 的结构阐述。可以从以下 4 个维度切入：

维度 1：流式响应（SSE）与高吞吐下，计费的“准确性与延时”矛盾

难点描述：大模型生成是流式返回的（SSE），若等全部生成完再计算 Token 并结算，一旦网络断开或客户端取消，容易造成计费漏扣；若实时逐 Token 计费并更新数据库，高并发下会引发 DB / Redis 热点 Key 锁冲突与 IO 瓶颈，降低 Gateway 的转发性能。

如何回答/解法：

预扣+尾帧结算：请求进入时利用 fast-tokenizer 做本地 Fast Estimate，按 max_tokens 进行 Redis 预扣费。请求流式传输时网关仅做 Memory Chunk Counting，在 SSE 最后一帧获取上游官方 usage（如果上游不支持，则将拼接后的 Chunk 在异步 Task 中 Tokenize）。

异步落盘与 Batch 写 DB：Redis 仅作为高频扣配额的缓存层，最终的日志流水（Log / Billing Record）通过 Kafka / RabbitMQ 异步解耦，批量写入 ClickHouse 或 PostgreSQL，保障网关主流程链路极低 Latency。

维度 2：异构 Tokenizer 的精确度与计算性能瓶颈

难点描述：不同 Provider / 模型（OpenAI, Claude, Llama 3, Qwen）使用的 Tokenizer 算法和词表（Tiktoken, SentencePiece, HuggingFace FastTokenizer）各不相同。在网关层使用 Python 逐个算 Token 极其消耗 CPU，且容易出现与上游 Provider 计算结果不一致的“微小误差”。   
docs.litellm.ai

如何回答/解法：

优先依赖 Provider 官方 Usage 字段：如 OpenAI 支持在流中开启 stream_options: {"include_usage": true}，Anthropic 提供 message_delta.usage，直接将上游返回的精确 Token 作为结算标准。   
LiteLLM documentation

Go/Rust 原生 Tokenizer 绑定：若必须在本地计算（如预扣费或上游缺失 Usage 时），避免在 Go/Python 中频繁跨语言调用，优先选用高性能的 CGo/Rust 绑定库（如 tiktoken-go 或 Rust 实现的 Tokenizer），并缓存已加载的模型词表，减少 CPU 瓶颈。

维度 3：高并发下的余额并发安全与超卖控制

难点描述：当同一个账号/API Key 绑定了多个并发 Agent 同时发起请求时，可能在几毫秒内触发上百个并发预扣费操作，产生典型的 Read-Modify-Write 竞态条件（Race Condition），导致余额被扣成负数（超扣）或者拒绝合法请求。

如何回答/解法：

Lua 脚本原子扣减：利用 Redis 单线程执行 Lua 脚本的特性，将“判断余额是否足够”与“执行扣减”合并在一个原子指令中，彻底规避并发竞争。

配额分片（Quota Sharding）/ 令牌桶变体：对于超大规模集群，将单个用户的总配额分散在不同的 Redis 节点上，或使用本地内存做一级预分配缓冲（Local Token Bucket），减少对全局 Redis 的频繁竞争。   
New API

维度 4：上游 Channel 状态管理、故障转移（Failover）与多租户隔离   
New API

难点描述：上游 API 经常出现 429 (Rate Limit)、5xx 报错、响应超时或流中途断开。若在中间阶段断开，如何精确计算已生成部分的费用？同时如何避免单用户高并发把全局上游 Channel 占满？

如何回答/解法：

断连阶段性结算：若客户端或上游中断，网关的 Stream Processor 捕获 ctx.Done()，对已接收到的 Chunk 字符串即时调用 Tokenizer 进行阶段结算，并将未消耗的预扣配额及时退回。

多级限流与熔断：实现基于 Leaky Bucket / Sliding Window 的多租户限流（支持用户级 RPM/TPM 限流与 Channel 级并发控制），配以自研的 Channel 动态健康度评估算法，一旦出现 429/503 自动触发代理熔断与请求降级重试。   
New API
