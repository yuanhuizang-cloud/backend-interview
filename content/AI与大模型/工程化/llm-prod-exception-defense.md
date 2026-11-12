---
id: llm-prod-exception-defense
type: 场景题
difficulty: hard
tags: [异常捕获, 超时降级, 安全防御]
sources: [gemini]
date: 2026-11-12
---

## 题目
详细梳理在生产环境中开发 LLM / Agent 应用时，常见的异常捕获、超时降级与安全防御方案。
ACP、UCP 协议我还是不太能理解 比如MCP协议写的mcp server 以及使用方式（比如codex通过配置），那么ACP、UCP 协议可以实现什么 以及实现的内容该如何使用 用代码或项目举例

## 回答
很好，用具体的 配置文件、网络请求和代码实现 来看，这三个协议的定位和分工会非常清晰。

首先明确三者的本质区别：

MCP (Model Context Protocol)：“AI 的插件/工具驱动” [cite: 1.2.2]（本地/RPC 机制，让单体 LLM 获取上下文和本地工具能力）。

ACP (Agent Communication Protocol)：“AI Agent 之间的 HTTP 通信标准”（分布式/网络机制，让不同团队/框架写的 Agent 可以相互发消息、派发长任务）。   
agentcommunicationprotocol.dev
+ 1

UCP (Universal Commerce Protocol)：“AI Agent 购物与交易的业务标准” [cite: 1.1.2]（应用层业务协议，让 Agent 能在电商网站完成选品、下单、授权与支付） [cite: 1.1.2]。

一、 ACP (Agent Communication Protocol) 是什么？怎么用？
1. 能实现什么？

假设你们公司有三个独立维护的 Agent：

需求分析 Agent（基于 LangChain 写的）   
IBM

代码生成 Agent（基于 AutoGen 写的）

自动化测试 Agent（基于 CrewAI 写的）

如果没有 ACP，你要让它们协作，就必须自己写一套复杂的 HTTP 路由、自定义 JSON 规范来把它们连接起来。
ACP 定义了一套标准的 RESTful API / SSE 事件流规范 [cite: 1.1.1]，不管 Agent 用什么框架写，只要实现了 ACP 接口，就能像微服务一样互相调用、感知状态和透传 Session。   
agentcommunicationprotocol.dev

2. 如何实现与使用（以 Python 为例）

第一步：定义并启动一个遵从 ACP 协议的“代码测试 Agent”

Python
# test_agent.py (测试 Agent 服务端)
from acp_sdk import ACPServer, Message, Thread
import uvicorn

app = ACPServer(title="Auto-Tester Agent", version="1.0.0")

# ACP 规范：通过统一的 @app.agent 装饰器暴露 Agent 节点
@app.agent(name="code-tester", description="负责接收代码并运行单元测试")
async def run_test(thread: Thread, message: Message):
    # 1. 解析 ACP 标准消息格式
    code_to_test = message.content.text
    
    # 2. 执行测试逻辑 (模拟)
    # ... 运行 pytest ...
    test_result = "✅ All 5 tests passed!"
    
    # 3. 返回遵从 ACP 格式的响应
    yield Message(content={"type": "text", "text": test_result})

if __name__ == "__main__":
    # ACP Agent 本质上是一个标准的 HTTP/REST 服务 [cite: 1.1.1]
    uvicorn.run(app, host="0.0.0.0", port=8001)


第二步：主控 Agent (如 IDE 或需求 Agent) 如何使用 ACP 调用它

主控 Agent 不需要导入任何测试 Agent 的 Python 代码，直接通过标准 HTTP/ACP 协议通信：   
agentcommunicationprotocol.dev

Python
import requests

# 1. 发现 Agent Capabilities (ACP 标准接口 /agents)
response = requests.get("http://localhost:8001/agents")
print("发现了可用 Agent:", response.json())

# 2. 派发异步/同步任务 (ACP 标准接口 POST /runs)
payload = {
    "agent_id": "code-tester",
    "inputs": [
        {"role": "user", "content": "def add(a, b): return a + b"}
    ]
}

# 任何语言、任何客户端都可以通过 REST 请求与 ACP Agent 交互
res = requests.post("http://localhost:8001/runs", json=payload)
print("收到 ACP Agent 返回结果:", res.json())

二、 UCP (Universal Commerce Protocol) 是什么？怎么用？
1. 能实现什么？

如果你的 AI 助手说：“我已经帮你在京东/亚马逊买好了明天去北京的机票和酒店”，或者“帮你在网上订了 2 磅草莓”。
过去如果让 Agent 去下单，要么靠 Playwright 模拟浏览器点击（极易失效），要么各个平台单独对接 API。
UCP 规范了“意图解析 ↔ 商品查询 ↔ 购物车构造 ↔ 授权/支付”的标准化 JSON-LD/API 协议 [cite: 1.1.2]。商户（如淘宝、携程、Shopify）接入 UCP 后，任何 Agent 都可以安全的替用户完成交易 [cite: 1.1.2]。

2. 如何实现与使用（代码与协议交互示例）

第一步：电商平台/服务商实现 UCP 端点（商户端）

商家在网站根目录下暴露 .well-known/ucp-configuration，声明其支持 UCP 交易规范：

JSON
// 商家的 UCP 配置文件：https://shop.example.com/.well-known/ucp-configuration
{
  "ucp_version": "2026-01-01",
  "capabilities": {
    "checkout": "https://api.shop.example.com/ucp/v1/checkout",
    "inventory": "https://api.shop.example.com/ucp/v1/products/search"
  },
  "supported_payment_protocols": ["AP2", "Stripe-Agent-Pay"]
}


第二步：AI Agent 如何使用 UCP 完成商业下单

当用户向 Agent 发出指令：“购买一套 2026 版 Python 高级编程，预算 100 元以内。”

Python
import requests

class UCPShoppingAgent:
    def __init__(self, merchant_domain: str):
        # 1. 自动读取商户的 UCP 配置信息
        config = requests.get(f"https://{merchant_domain}/.well-known/ucp-configuration").json()
        self.checkout_url = config["capabilities"]["checkout"]

    def create_agent_order(self, product_id: str, user_auth_token: str):
        # 2. 根据 UCP 标准格式构建“带授权的购买意图” Payload
        ucp_checkout_payload = {
            "@context": "https://schema.ucp.dev/v1/Checkout",
            "action": "CREATE_ORDER",
            "order_intent": {
                "items": [
                    {"product_id": product_id, "quantity": 1}
                ],
                "max_budget": {"currency": "CNY", "amount": 100.00}
            },
            # 使用安全的双向加密 Auth Token，保护用户支付安全
            "payment_delegation": {
                "protocol": "AP2",
                "user_delegated_token": user_auth_token
            }
        }

        # 3. 提交至商户端进行标准履约
        response = requests.post(self.checkout_url, json=ucp_checkout_payload)
        return response.json()

# 使用示例
agent = UCPShoppingAgent("shop.example.com")
order_result = agent.create_agent_order(product_id="prod_99812", user_auth_token="usr_tok_x87123")
print("UCP 订单创建状态:", order_result["status"])  # 例如: "ORDER_CREATED_PENDING_USER_CONFIRMATION"

三、 三大协议全局拓扑与对比

在一个复杂的“个人 AI 助理”完成任务的全流程中，这三个协议是协同工作的，而不是竞争关系 [cite: 1.2.2]：

Plaintext
  ┌────────────────────────────────────────────────────────┐
  │                   用户 (User)                           │
  └──────────────────────────┬─────────────────────────────┘
                             │ "帮我检查服务器日志并下单一台新服务器"
                             ▼
 ┌──────────────────────────────────────────────────────────┐
 │                  主控 Agent (Client)                     │
 └──────┬────────────────────┬──────────────────────┬───────┘
        │                    │                      │
        │ MCP 协议           │ ACP 协议             │ UCP 协议 [cite: 1.1.2]
        │ (本地/工具调用)    │ ( Agent 间协作 )      │ (商业/支付履约) [cite: 1.1.2]
        ▼                    ▼                      ▼
┌──────────────┐     ┌──────────────┐      ┌─────────────────┐
│ MCP Server   │     ┌ ACP Agent    │      │ UCP Merchant    │
│ (读日志/DB)  │     │ (运维分析Agent)│      │ (AWS/阿里云 API) │
└──────────────┘     └──────────────┘      └─────────────────┘

总结对比表格
协议	一句话解决的问题	协议载体 / 传输机制	研发接入口 (Dev Entry)
MCP [cite: 1.2.2]	单体 LLM 如何优雅调用本地/私有工具和数据？	Standard I/O (STDIO) / Server-Sent Events (SSE) / JSON-RPC [cite: 1.2.2]	写一个 MCP Server 暴露 tools，修改 Client 的配置文件（如 mcpServers）。
ACP [cite: 1.2.2]	跨平台/框架的 Agent 之间如何互相发消息、派发长任务？	RESTful API / Standard HTTP EventStream [cite: 1.1.1]	用 Python/TS SDK 编写遵循 ACP 路由规范的 Web API 服务。
UCP [cite: 1.1.2]	Agent 怎么安全地在第三方商家下订单、完成支付闭环？ [cite: 1.1.2]	HTTP POST (JSON-LD 格式，符合 Schema.org 商业扩展)	商家端暴露 .well-known/ucp-configuration，Agent 端实现标准 Checkout 构造 [cite: 1.1.2]。
