---
id: plugin-skill-mcp-function-calling
type: 概念题
difficulty: medium
tags: [MCP, FunctionCalling, Plugin, Skill]
sources: [gemini]
date: 2026-11-12
---

## 题目
plugin\skill\mcp\func calling的区别

## 回答
在现代化 AI 系统、Agent 架构与大模型（LLM）开发中，Function Calling、Plugin、MCP 和 Skill 是实现“大模型连接外部工具与数据”不同阶段的产物。它们并非完全对立，而是处于从底层协议到上层架构不同层级的抽象。

一图看懂它们在架构中的位置与关系：

Plaintext
┌─────────────────────────────────────────────────────────────┐
│              用户应用 / Agent 接入层                         │
├──────────────────────────────┬──────────────────────────────┤
│    Skill (技能/业务逻辑)      │     Plugin (插件/功能拓展)   │
├──────────────────────────────┴──────────────────────────────┤
│                 MCP (Model Context Protocol)                │
│         统一协议层：解耦客户端(Agent)与服务端(工具/数据)     │
├─────────────────────────────────────────────────────────────┤
│             Function Calling (底层能力/API)                 │
│         模型层：大模型输出结构化 JSON (函数名+参数)           │
└─────────────────────────────────────────────────────────────┘

一、 核心定义与对比表
维度	Function Calling (函数调用)	Plugin (插件)	MCP (模型上下文协议)	Skill (Agent 技能)
定位	大模型底层的原生能力	端到端的业务功能模块	跨系统连接的标准开放协议	面向任务的标准作业流程 (SOP)
解决的核心问题	怎么让大模型输出结构化的数据（如 JSON）来调用代码	怎么给某个特定的平台（如 ChatGPT）快速加一个新功能	怎么解决工具/数据源与多个 AI 客户端重复对接的问题	怎么把多步骤流程与领域知识打包成可复用的工作流
所属层级	模型/API 层	应用/平台层	协议/网络层	逻辑/工程层
代表案例	OpenAI API tools 参数, DeepSeek Tool Call	ChatGPT Plugins, Dify 插件	Anthropic 提出的 MCP Protocol (Cursor/Claude Desktop 已集成)	AutoGen Skills, Claude Code/CC-Switch 中的 Skill 定义
二、 逐一拆解与应用场景
1. Function Calling（函数调用）：最底层的“脚手架”

是什么：大模型厂商（OpenAI、Anthropic、DeepSeek 等）在其 API 层面提供的一种结构化输出能力。

运作原理：开发者在调用模型时，传入函数的描述（名称、参数 schema）。大模型根据用户输入，决定是否需要调用函数，并返回符合 schema 的 JSON 字符串（例如：{"name": "get_weather", "arguments": {"city": "Beijing"}}）。模型本身不执行代码，需要你的应用拿到 JSON 后去实际执行函数并把结果喂回模型。

优点：精准、结构化，是上层所有工具调用的基础。

缺点：过于底层，每次增加新工具都要重新写接口定义和代码逻辑。

2. Plugin（插件）：早期封装的“端到端功能包”

是什么：在 Function Calling 之上建立的一套应用级拓展机制（如早期 ChatGPT Plugins 或各种 AI 平台的插件）。

运作原理：一个 Plugin 通常包含 openapi.json（定义有什么接口）和 ai-plugin.json（定义插件元数据与提示词）。用户在 UI 界面点击勾选后，平台自动帮用户打通从“意图识别 
→
→ 调用第三方 API 
→
→ 解析结果 
→
→ 回传模型”的全流程。

优点：对非技术用户极度友好，即插即用。

缺点：生态相对封闭（如 OpenAIP 插件生态已逐渐被自定义 GPTs 取代），且插件与特定平台绑定严重。

3. MCP (Model Context Protocol)：AI 时代的“USB 标准协议”

是什么：由 Anthropic 在 2024 年底开源的模型上下文协议。它不是一个具体的工具，而是一套类似于 Web 领域的 HTTP 协议 或 IDE 领域的 LSP 协议（Language Server Protocol）。

运作原理：

MCP Client（客户端）：如 Cursor、Claude Desktop、Dify、自研 Agent 框架。

MCP Server（服务端）：如 Postgres 数据库连接器、GitHub 接口服务、本地文件系统服务。

核心价值：只要每个人都实现 MCP 协议，任意 MCP Client 就能无缝挂载任意 MCP Server，再也不用为每个 Agent 框架单独写一遍对接代码了。

适用场景：跨平台、跨工具解耦。比如你写了一个连接公司内部 DB 的 MCP Server，可以在 Cursor 里用，也能直接挂载到 Claude Desktop 或自己写的 Go Agent 框架里用。

4. Skill（技能）：面向 Agent 的“专家知识与 SOP 包”

是什么：在 Agent 框架（如 LangChain、Claude Code、Dify 等）中，将特定的领域知识、多步骤工作流（Prompt/代码/模板）打包成的一个高阶模块。

与 Tool 的区别：一个 Tool（工具）通常只是一个原子 API（如“发送邮件”）；而一个 Skill 是一套解决特定复杂问题的 SOP（如“代码重构技能”：包含先分析 AST、再调用单元测试、最后生成 PR 的完整逻辑与策略）。

适用场景：将高频、稳定的团队业务规范（如“日志排查标准流程”、“符合公司规范的 Go 接口生成器”）沉淀下来，供 Agent 在特定场景下自动触发。

三、 总结：四者如何配合工作？

假设你正在使用一个 AI 编程助手（Agent） 来帮你自动修复数据库 Bug：

Skill（上层业务逻辑）：Agent 加载了名为 db-bug-fixer 的 Skill，里面写明了“排查 Bug 的标准流程：第一步查日志，第二步查数据库锁，第三步提交修复方案”。

MCP（中间协议层）：Agent（作为 MCP Client）通过 MCP 协议 连接到了你本地运行的 Postgres MCP Server 和 GitHub MCP Server。

Function Calling（底层传输）：当 Agent 决定执行具体的 SQL 查询命令时，底层依赖大模型的 Function Calling 能力，生成符合规格的 {"sql": "SELECT * FROM locks..."} 结构化 JSON 指令。

Plugin（外部生态）：如果你在这个过程中调用了某个第三方商业服务的标准插件（如 Jira 关联插件），它背后往往是以 Plugin 的形态集成进来的。
