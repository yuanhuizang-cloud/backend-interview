---
id: llm-sse-stream-token-calc
type: 场景题
difficulty: hard
tags: [SSE, 流式, Token计算]
sources: [gemini]
date: 2026-11-12
---

## 题目
大模型网关在处理 SSE 流式代理时，如果中途断开，如何精确计算已消耗的 Token 并扣除余额？

## 回答
面试官您好！这个问题在设计大模型网关（如 LiteLLM、NewAPI、sub2api）时非常关键。大模型网关不能简单地把上游错误“生搬硬套”成传统的 HTTP 状态码，因为 LLM 涉及流式传输（SSE）、复杂的业务状态（如安全审查、长度截断）以及多租户计费安全。

结合开源网关的真实实现，我从状态码归因、分类处理逻辑、以及配套的代码实现三个方面向您汇报：

一、 大模型错误的常见状态码归因与分类处理

参考 LiteLLM 和 NewAPI 的生产实践，网关对上游错误的归因和映射关系通常如下：

上游原始错误/事件	触发场景	网关映射的状态码	网关处理策略（处理动作）
HTTP 429 (Rate Limit)	上游 TPM/RPM 超限或欠费	429 Too Many Requests	不向客户端直接报错，优先触发网关内置的 Failover（故障转移），轮询切换至备用 Channel。若全部 Channel 满载，再向客户端返回规范的 429。
HTTP 500 / 502 / 503	厂商服务器过载或宕机	502 Bad Gateway / 503 Service Unavailable	记录错误日志，触发自动重试（Exponential Backoff）或无缝切流。若重试失败，友好提示并返回 502。
Content Moderation / Safety	触发敏感词/涉黄涉暴审查	400 Bad Request 或 422 Unprocessable Entity	绝对不重试。原封不动或包装为标准化错误提示透传给客户端，同时终止当前流。
finish_reason: "length"	达到 max_tokens 上限被截断	200 OK（非错误，属正常业务结束）	不是错误。正常计算已生成的 Token 费用，并在 SSE 末尾正常下发 [DONE] 闭合。
Stream Interruption (中途断连)	生成到一半网络/上游死锁中断	200 OK (在已输出流中追加错误块) 或 504	捕获异常，对已传输的 Token 结算，并在 SSE 流末尾注入带有错误说明的 Chunk，保证客户端不卡死。
二、 网关错误处理与返回的代码实现（Python 异步实现参考）

在真实的网关中（类似于 LiteLLM 的 Proxy 异常捕获层），我们需要将上游的各种异常统一归一化为标准的 OpenAI 兼容错误格式，并兼顾流式（SSE）与非流式（Non-Stream）的错误分流：

Python
import json
import traceback
from typing import AsyncGenerator
import httpx

# ==================== 1. 标准错误响应结构体 ====================
def create_error_response(status_code: int, message: str, err_type: str, code: str) -> dict:
    """
    遵循 OpenAI 标准错误响应格式
    """
    return {
        "error": {
            "message": message,
            "type": err_type,
            "param": None,
            "code": code
        }
    }, status_code


# ==================== 2. 网关上游请求与错误归因处理器 ====================
async def proxy_completion_with_error_handling(client_request: dict) -> tuple[dict | AsyncGenerator, int]:
    """
    模拟网关调用上游大模型（如 OpenAI / Anthropic）并进行细粒度错误归因
    """
    upstream_url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": "Bearer sk-real-upstream-key"}

    try:
        # 发起对上游的异步请求
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(upstream_url, json=client_request, headers=headers)

        # ------------------- A. 处理明确的 HTTP 错误状态码 -------------------
        if response.status_code != 200:
            error_body = response.text
            try:
                err_json = response.json()
                error_message = err_json.get("error", {}).get("message", error_body)
            except Exception:
                error_message = error_body

            # 429 触发网关层 Failover 逻辑（此处简化为直接返回规范错误）
            if response.status_code == 429:
                return create_error_response(
                    429, 
                    f"Upstream Rate Limit Exceeded: {error_message}", 
                    "rate_limit_error", 
                    "rate_limit_exceeded"
                )
            
            # 5xx 归因为服务不可用
            elif response.status_code >= 500:
                return create_error_response(
                    502, 
                    f"Upstream Provider Internal Error: {error_message}", 
                    "upstream_error", 
                    "bad_gateway"
                )
            
            # 400 系列（如鉴权失败、参数错误、内容安全拦截）
            else:
                return create_error_response(
                    response.status_code, 
                    f"Upstream Bad Request: {error_message}", 
                    "invalid_request_error", 
                    "upstream_bad_request"
                )

        # ------------------- B. 处理正常响应或流式代理 -------------------
        if client_request.get("stream", False):
            # 返回流式生成器，并在流中捕获中途断连异常
            return safe_stream_proxy(response), 200
        else:
            data = response.json()
            # 检查上游业务级安全拦截（部分厂商会在 200 OK 的 body 中返回 content_filter 错误）
            choices = data.get("choices", [])
            if choices and choices[0].get("finish_reason") == "content_filter":
                return create_error_response(
                    400, 
                    "Your request was rejected by the upstream content safety filter.", 
                    "content_filter", 
                    "content_filtered"
                )
            return data, 200

    except httpx.TimeoutException:
        # 针对上游响应超时的特殊处理
        return create_error_response(
            504, 
            "Gateway Timeout: Upstream LLM provider took too long to respond.", 
            "timeout_error", 
            "gateway_timeout"
        )
    except httpx.RequestError as e:
        # 网络连接底层错误
        return create_error_response(
            502, 
            f"Gateway Network Error: Failed to connect to upstream. Details: {str(e)}", 
            "network_error", 
            "bad_gateway"
        )


# ==================== 3. 流式传输（SSE）中的异常兜底与友好闭合 ====================
async def safe_stream_proxy(upstream_response) -> AsyncGenerator[str, None]:
    """
    在 SSE 流传输过程中，若发生中途断开或异常，网关如何安全收尾
    """
    try:
        async for line in upstream_response.aiter_lines():
            if line.startswith("data: "):
                # 正常透传 Chunk
                yield f"{line}\n\n"
                
        # 正常结束
        yield "data: [DONE]\n\n"
        
    except Exception as stream_err:
        # 流传输中途崩溃：不能直接断开 TCP，需要在 SSE 尾部注入一个友好的错误提示块
        error_chunk = {
            "error": {
                "message": f"Stream interrupted due to upstream error: {str(stream_err)}",
                "type": "stream_error",
                "code": "stream_interrupted"
            }
        }
        yield f"data: {json.dumps(error_chunk)}\n\n"
        yield "data: [DONE]\n\n"

三、 总结面试要点

在面试中向面试官阐述这部分时，可以提炼出这三个核心设计原则：

统一错误规范（Standardization）：不管上游是 Anthropic、Google 还是 OpenAI 或者是私有化 vLLM，网关必须将其错误归一化包装成统一的 OpenAI 格式（error: { message, type, code }），降低客户端的适配成本。

拒绝盲目重试（Smart Retries）：明确区分“可恢复错误”（如 429、502 触发切通道重试）与“不可恢复错误”（如 400 参数错、内容安全拦截直接透传），避免无效重试雪崩。

流式容灾（Graceful Stream Degradation）：针对 SSE 传输到一半挂掉的极端场景，不能返回畸形的 HTTP 响应，而是要在数据流末尾追加标准的错误 JSON 后安全闭合，保障客户端 SDK 不会抛出反序列化崩溃异常。
