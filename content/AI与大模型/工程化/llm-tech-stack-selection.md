---
id: llm-tech-stack-selection
type: 概念题
difficulty: medium
tags: [Ollama, LlamaIndex, RAG, 选型]
sources: [gemini]
date: 2026-11-12
---

## 题目
这几个topic 哪个对我找工作比较友好 实现起来简单 或者分别需要用到当前主流招聘市场的什么技术：
| Tool Gateway | Agent ->（LLM Gateway + Tool Gateway） | | |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 企业内部智能体 | <br> | <br> | |
| Dify平台 | <br> | 自托管 | <br> |
| 产设研AI协作平台 | <br> | **知识资产沉淀**：把“调试过程”、“修复思路”和“Prompt 模版”打造成企业私有知识库，共享最佳实践，避免经验流失。 | **跨角色协作无缝接轨**：测试提 Bug 后附带 Agent 对话历史，前端/后端开发接手时直接延续 Session，无需重复对齐上下文，节省沟通成本 |
| 私有大模型 | 数据保密 | | |

## 回答
从找工作友好度、实现难度以及主流市场技术栈三个维度，对表格中的 4 个 Topic 进行深度拆解与对比分析：

一、 结论速览

求职最友好、最推荐：Dify 平台 & Tool Gateway / Agent 架构

上手实现最简单：Dify 平台

技术壁垒最高、难度最大：Tool Gateway / Agent 架构 与 私有大模型

二、 四大 Topic 详细拆解与技术栈对比
1. Dify 平台（自托管 / 应用开发）

找工作友好度：⭐⭐⭐⭐⭐（极高）   
docs.emergence.ai

原因：目前大部分中小型企业、传统企业或非纯 AI 核心业务部门，急需“快速把 AI 落地到具体业务”的人才。熟悉 Dify 自托管、插件开发和工作流（Workflow）编排，能让你快速胜任 AI 应用工程师、AI 产品交付等岗位。

实现难度：⭐（极易）

开箱即用，通过 Docker Compose 即可完成自托管部署，绝大多数逻辑通过可视化拖拽完成。

核心技术栈：

部署运维：Docker / Docker Compose、Vector DB（Milvus/Qdrant/PGVector）、Redis、PostgreSQL。

平台扩展：Python / TypeScript（用于编写 Dify 自定义 Tool 插件、Extension API）。

业务逻辑：Prompt 工程、工作流编排、RAG 参数调优（Chunk 策略、混合检索、重排序 Rerank）。

2. Agent 架构（LLM Gateway + Tool Gateway）

找工作友好度：⭐⭐⭐⭐⭐（极高）

原因：这是目前大厂及 AI  Native 初创公司核心工程岗位（AI Agent 开发/基础设施岗位）最看重的能力。了解如何做工具网关、权限隔离、统一路由和鉴权，直接对应高薪的 AI Agent 架构师或高级后端岗位。

实现难度：⭐⭐⭐⭐（较难）

涉及微服务架构、动态路由、MCP（Model Context Protocol）协议、安全鉴权及状态管理（Session Management）。

核心技术栈：

网关与路由：LiteLLM（LLM Gateway）、MCP 协议（Tool Gateway）、Envoy / Kong / FastAPI / Go。

Agent 编排框架：LangGraph、CrewAI、LlamaIndex Workflows。   
AWS Documentation

中间件与安全：OAuth2 / OIDC（工具鉴权）、Redis（Session 与工具调用状态持久化）、OpenTelemetry / LangSmith（全链路日志追踪）。

3. 产设研 AI 协作平台（知识资产沉淀 + 跨角色 Session 延续）

找工作友好度：⭐⭐⭐（中等偏上）

原因：偏向企业内部 Tooling（内部效能工具）。如果你投递的是研发效能组（DevOps/Developer Experience）、提效团队或企业信息化部门，这是一个极佳的加分项；但对于通用 AI 研发岗，针对性较强。

实现难度：⭐⭐⭐（中等）

核心逻辑是“前端 UI 交互 + 后端 Session 状态共享 + 研发数据源接入”。

核心技术栈：

平台与系统集成：GitLab / GitHub API / Jira API 深度对接（把 Agent 上下文自动挂载到 Bug 或 MR 页面）。

上下文与 Session 管理：前端持久化组件、向量数据库（代码/Debug 思路切片存储）、Redis Session 链条。

知识库与 RAG：GraphRAG 或 Hybrid Search（处理代码与长文本的关联检索）。

4. 私有大模型（数据保密 / 本地化部署）

找工作友好度：⭐⭐⭐（因岗而异）

原因：如果只是简单的 Ollama / vLLM 部署，技术门槛较低，加分有限；如果是涉及模型微调（SFT）、量化、算力集群调度，则门槛极高，对应专职的算法工程师/模型部署工程师岗位。

实现难度：⭐⭐⭐⭐（较难 / 取决于深度）   
MLflow

纯推理部署简单；但若要做高并发推理优化、模型微调与私有化数据安全隔离，难度陡增。

核心技术栈：

推理与部署引擎：vLLM、Ollama、TGI（Text Generation Inference）、TensorRT-LLM。

模型微调与量化：LLaMA-Factory、Unsloth、DeepSpeed、LoRA / QLoRA、GGUF / AWQ / GPTQ 量化。

硬件与底座：CUDA、NVIDIA Triton Inference Server、K8s + KServe（算力弹性调度）。

三、 总结与求职建议

如果你想快速出成果、面中小厂/业务 AI 落地岗：

首选：Dify 平台。拿现成的开源项目搭建一套支持自托管的业务工作流，上手最快，能在简历上迅速写出一个完整的项目。

如果你目标是大厂/高薪 AI Agent 研发岗：

首选：Agent -> (LLM Gateway + Tool Gateway)。深入理解 MCP 协议，用 LiteLLM + FastAPI 搭建统一的模型与工具路由网关，展示你在高并发、安全性、统一鉴权及状态管理上的后端硬实力。
