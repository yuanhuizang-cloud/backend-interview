---
id: mcp-acp-ucp-protocol
type: 概念题
difficulty: medium
tags: [MCP, ACP, UCP, Agent]
sources: [gemini]
date: 2026-11-12
---

## 题目
MCP/ACP/UCP 三协议分别是什么 应用场景和区别
“理解 LLM 应用开发范式，熟悉 Prompt Engineering”对研发来说主要需要掌握什么技能 用代码举例说明

## 回答
一、 MCP、ACP、UCP 三大协议解析

在 LLM 应用和 AI Agent 生态中，这三个协议对应了不同层级的标准化协作：

1. 协议核心概念与定义

MCP (Model Context Protocol - 模型上下文协议)   
Medium

概念：由 Anthropic 主导提出的开放标准 [cite: 1.2.1]，类似于 AI 界的 "USB-C 接口"。它定义了 LLM 客户端（如 Claude Desktop, Cursor, AI Agent）与外部资源/工具服务器之间的通信规范 [cite: 1.2.1]。   
Akka.io

解决痛点：过去每个 LLM 应用调用外部数据库、API 或本地文件系统都要独立编写适配器。MCP 统一了工具调用（Tools）、上下文读取（Resources）和提示词模板（Prompts）的标准 [cite: 1.2.1]。   
Akka.io

ACP (Agent Context Protocol / Agent Communication Protocol - Agent 上下文/通信协议)   
Medium

概念：专注于 多 Agent 协作 场景，用来规范 Agent 之间的任务分发、状态同步、信念/目标（Beliefs & Goals）转移与上下文共享 [cite: 1.2.2]。   
Akka.io
+ 1

解决痛点：在多 Agent 协同系统（如 CrewAI、AutoGen）中，解决“Planner Agent 如何把拆解好的任务和私有上下文安全透传给 Coder/Tester Agent”的问题 [cite: 1.2.2]。

UCP (Universal Commerce Protocol - 通用商业协议)   
Codelabs - Google

概念：由 Google、Shopify、Stripe 等行业巨头联合推出的开放协议，用于规范 AI Agent 与商业生态（电商/服务/支付）之间的交易行为。   
ucp.dev

解决痛点：解决 AI Agent“能聊天但无法直接替用户下单/履约”的问题 [cite: 1.1.2]。UCP 规定了商品检索、购物车构建、意图确认、带授权支付（配合 AP2 协议）的全链路交互规范。   
Medium

2. 应用场景与对比矩阵
维度	MCP (模型上下文协议)	ACP (Agent 协作协议)	UCP (通用商业协议)
层级位置	基础连接层（LLM ↔ 工具/数据）	协同逻辑层（Agent ↔ Agent）	业务履约层（Agent ↔ 外部商业服务） [cite: 1.1.2]
核心角色	Client (LLM) 与 Server (Tools) [cite: 1.2.1]	Initiator Agent 与 Target Agent	Consumer Agent 与 Merchant Service [cite: 1.1.2]
典型应用场景	

• 让 Cursor/Claude 直接读取 PostgreSQL 数据库




• 链接 GitHub API 进行 Code Review

	

• 多 Agent 软件开发（规划者→代码编写者→测试者） [cite: 1.2.2]




• 复杂研报撰写（分工采集与汇总）

	

• “帮我订一张明天飞北京最便宜机票并支付” [cite: 1.1.5]




• AI 代理采购与多平台比价下单


类比	电脑的 USB 接口（接入鼠标、硬盘）	团队里的 高效沟通语言/工作流	信用卡支付网关与标准合同 [cite: 1.1.1]
二、 研发人员需要掌握的“LLM 开发范式与 Prompt 工程”

对于后端或全栈研发来说，掌握 LLM 开发范式绝不仅仅是“在网页上写提示词”，而是将 LLM 当成一种具有不确定性的“概率计算单元”，并用确定性的工程代码对其进行封装、路由、校验与状态控制。

核心技能矩阵包括：

结构化输出（Structured Output）：强制 LLM 输出校验通过的 JSON/Pydantic 对象。

上下文管理与 Prompt 模版化（Prompt Engineering）：变量注入、Few-Shot 示例构造、System Prompt 角色隔离。

工具调用与闭环控制（Tool Calling / Function Calling）：解析 LLM 意图、执行本地/远程代码、将结果回填给 LLM。   
Akka.io

防御性编程与容错处理：非法 JSON 容错纠正、幻觉重试机制（Self-Correction Loop）、Token 长度超限截断。

代码示例：标准 LLM 研发范式（Python 实现）

以下演示一个符合现代工程规范的 LLM 工具调用与结构化提取范式（基于 OpenAI API + Pydantic）：

Python
import json
from typing import List, Optional
from pydantic import BaseModel, Field
from openai import OpenAI

client = OpenAI()

# -------------------------------------------------------------------
# Skill 1: 结构化输出定义 (用 Pydantic 替代自由文本解析)
# -------------------------------------------------------------------
class UserIntent(BaseModel):
    action: str = Field(description="用户想执行的操作，例如 'search_database', 'create_ticket'")
    query: str = Field(description="提取出的核心查询或操作目标")
    filters: Optional[dict] = Field(default=None, description="操作需要的可选筛选条件")

# -------------------------------------------------------------------
# Skill 2: 动态 Prompt 模版与防注入设计
# -------------------------------------------------------------------
SYSTEM_PROMPT = """
你是一个精准的后端意图解析引擎。
你的唯一任务是将用户的自然语言转换为结构化的指令参数。
规则：
1. 严禁回答与意图解析无关的问题。
2. 如果无法识别意图，将 action 设为 'unknown'。
"""

def build_few_shot_messages(user_input: str) -> List[dict]:
    # 结合 Few-Shot 示例提升复杂场景下的稳定度
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        # Few-shot 1
        {"role": "user", "content": "查一下昨天提交的支付失败日志"},
        {"role": "assistant", "content": json.dumps({
            "action": "search_database",
            "query": "payment_failure_logs",
            "filters": {"date": "yesterday"}
        })},
        # 当前实际输入
        {"role": "user", "content": user_input}
    ]

# -------------------------------------------------------------------
# Skill 3 & 4: 带有自动容错纠正（Self-Correction）的执行循环
# -------------------------------------------------------------------
def parse_user_intent_with_retry(user_input: str, max_retries: int = 2) -> UserIntent:
    messages = build_few_shot_messages(user_input)
    
    for attempt in range(max_retries + 1):
        try:
            # 使用 Structured Outputs API 保证 Schema 强制匹配
            response = client.beta.chat.completions.parse(
                model="gpt-4o-mini",
                messages=messages,
                response_format=UserIntent,
                temperature=0.0  # 降低随机性，提高稳定性
            )
            
            result: UserIntent = response.choices[0].message.parsed
            return result

        except Exception as e:
            print(f"[Warn] 解析失败 (Attempt {attempt + 1}/{max_retries + 1}): {e}")
            if attempt == max_retries:
                raise RuntimeError("LLM 输出解析屡次失败，触发降级策略。")
            
            # 将错误信息反馈给 LLM 进行自纠错 (Self-Correction Loop)
            messages.append({"role": "assistant", "content": response.choices[0].message.content or ""})
            messages.append({
                "role": "user", 
                "content": f"你的上一次输出格式不符合 JSON Schema 规范，错误信息：{str(e)}。请严格重新生成！"
            })

# -------------------------------------------------------------------
# 执行测试
# -------------------------------------------------------------------
if __name__ == "__main__":
    test_query = "帮我看看工单系统里紧急程度是 High 的 API 报错单"
    
    intent = parse_user_intent_with_retry(test_query)
    print("✅ 成功解析结构化意图:")
    print(f"Action:  {intent.action}")
    print(f"Query:   {intent.query}")
    print(f"Filters: {intent.filters}")
