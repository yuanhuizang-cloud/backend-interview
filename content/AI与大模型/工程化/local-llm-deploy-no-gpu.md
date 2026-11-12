---
id: local-llm-deploy-no-gpu
type: 场景题
difficulty: medium
tags: [本地部署, 大模型, 无GPU]
sources: [gemini]
date: 2026-11-12
---

## 题目
但是大语言模型是外部的 是不是也不安全 怎么本地部署一个自己的大语言模型 （没有gpu）

## 回答
你的顾虑非常准确，这也正是大多数企业在落地 AI 时最关心的问题：

直接调用外部大模型 API 确实存在安全隐患：你上传的文档（如合同、财务数据、代码）需要传输到外部服务器，数据可能存在泄露风险，或者被第三方厂商用于模型训练（取决于隐私条款）。

完全本地部署（模型+平台）：如果将“Dify 平台”和“大语言模型（LLM）”都部署在公司本地服务器，所有数据和计算均不出内网，能彻底解决安全问题。

针对没有 GPU（纯 CPU 服务器）的情况，完全可以实现本地部署，具体解决方案与操作步骤如下：

一、 没有 GPU，纯 CPU 怎么运行大模型？

传统的大模型（如 70B 甚至更大）必须依赖 GPU。但在纯 CPU 环境下，可以通过 量化技术（Quantization） 和 轻量级小模型（Small Language Models / SLMs） 来流畅运行。   
BuildWithMatija

量化技术（GGUF 格式）：把模型的精度压缩（例如 4-bit 量化），将内存占用降低 70% 以上，并大幅提升 CPU 运行速度。

推理引擎选择：推荐使用 Ollama。它是专门为本地运行设计的工具，底层基于 llama.cpp，对纯 CPU 环境优化极佳，且能与 Dify 无缝对接。   
Northflank

二、 部署架构图与方案选择

整个本地架构为：
用户浏览器 ➔ Dify (Docker部署) ➔ Ollama (运行本地模型) ➔ 所有数据全在本地内存/硬盘处理

推荐的 CPU 模型组合（根据你的服务器内存选择）
服务器内存	推荐模型	适用场景	纯 CPU 输出速度估计
8 GB - 16 GB	Qwen2.5:1.5B 或 Qwen2.5:3B	简单对话、文档提取、分类	非常快（接近打字速度）
16 GB - 32 GB	Qwen2.5:7B 或 DeepSeek-R1-Distill-Qwen-1.5B/7B	内部知识库 RAG 问答、公文写作、复杂推理	较快（约 5 ~ 15 字/秒）
32 GB - 64 GB	Qwen2.5:14B	高质量总结、代码编写、多步工作流处理	一般（约 2 ~ 5 字/秒，适合后台异步处理）

注：Qwen2.5（通义千问开源版） 和 DeepSeek-R1 蒸馏版 是目前中文理解与知识库问答效果最好的开源模型之一。

三、 纯 CPU 部署步骤（实操指南）

假设你的服务器是 Linux (如 Ubuntu/CentOS)。

步骤 1：安装 Ollama 并下载 CPU 模型

在服务器上运行命令安装 Ollama：

Bash
curl -fsSL https://ollama.com/install.sh | sh


下载并运行适于 CPU 的轻量大模型（以 Qwen2.5 7B 为例）：

Bash
ollama run qwen2.5:7b


(下载完成后直接在终端输入问题测试，输入 /bye 退出)

修改 Ollama 配置，使其允许 Dify（Docker）跨容器访问：
修改环境变量，设置 OLLAMA_HOST=0.0.0.0，然后重启 Ollama 服务：

Bash
sudo systemctl edit ollama.service


在打开的文件中添加：

Ini, TOML
[Service]
Environment="OLLAMA_HOST=0.0.0.0"


保存并重启：

Bash
sudo systemctl daemon-reload
sudo systemctl restart ollama

步骤 2：在 Dify 中对接本地模型

登录已部署好的 Dify 平台。

进入 【设置】->【模型供应商】-> 选择 【Ollama】。

填入配置：

模型类型：LLM   
BuildWithMatija

模型名称：qwen2.5:7b （必须与 Ollama 中 pull 的名称一致）

基础 URL (Base URL)：[http://host.docker.internal:11434](http://host.docker.internal:11434) (如果 Dify 和 Ollama 在同一台机器)

点击“保存”，如果显示成功，说明 Dify 已经完全脱离互联网，使用的是你本地 CPU 运行的私有大模型。

四、 CPU 部署的利弊与建议
纯 CPU 部署的性能限制提示

缺点：CPU 计算并发能力较弱，如果公司内部有 10 个人同时向模型提问，CPU 会满载，回答速度会变慢或需要排队。

建议：

优先使用 1.5B ~ 7B 参数量的小模型，它们在 CPU 上跑得很快，且对于普通的规章制度问答（RAG 知识库）效果已经足够好。

如果后续使用人数增加（如超过 20 人同时使用），建议给服务器补充一张入门级消费级显卡（如 RTX 4090 或 RTX 3090/4080），推理速度和并发量会带来质的提升。

您接下来想了解哪方面的具体操作？
了解如何拉取 DeepSeek 模型
配置 Dify 访问本地 Ollama
