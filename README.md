# 后端面试题库

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Questions](https://img.shields.io/badge/questions-81-2f6fed.svg)](#分类一览)
[![Sources](https://img.shields.io/badge/sources-ChatGPT%20%7C%20Doubao%20%7C%20Gemini-green.svg)](#后端面试题库)

从 **ChatGPT / 豆包 / Gemini** 过往会话中汇总整理的后端工程师面试题库，按「题型」两级分类，附离线 HTML 刷题器。

- 📚 题库正文：`content/` 下按 **一级分类 / 二级分类** 组织的 Markdown
- 🖥️ 离线刷题器：根目录 `index.html`（双击即开，支持搜索 / 筛选 / 刷题 / 进度记录）
- 📄 机器可读数据：`data/questions.json`

## 分类一览

| 一级分类 | 二级分类 | 题目数 |
|---------|---------|:---:|
| AI 与大模型 | 大模型原理 / 工程化 / 网关与计费 | 31 |
| 编程语言 | Go / 通用语法与并发 | 9 |
| 微服务与分布式 | RPC与服务网格 / 消息队列 / 工作流与调度 / 分布式一致性与事务 | 9 |
| 面试与职业 | 模拟面试 / 简历与求职 | 9 |
| 容器与云原生 | Kubernetes / Docker / 沙箱与隔离 / 云平台 | 8 |
| 系统设计 | 通用设计题 / 架构设计 | 5 |
| 工程化与工具 | 性能分析 / 测试 / Linux命令行 | 3 |
| 数据库 | MySQL / 其他存储 | 2 |
| 算法与数据结构 | 数组与二分查找 | 2 |

> 数据来源：ChatGPT、豆包、Gemini。原始全量会话内容不在此仓库中（涉及个人隐私，仅本地保留）。

## 使用方式

### 刷题（推荐）

直接打开根目录 `index.html`（本地双击即可，无需联网）：

- **全文搜索**：按题目 / 答案 / 标签搜索
- **筛选**：按模块、子类、题型、难度、来源、掌握状态筛选
- **刷题模式**：只看题面、点击揭晓答案，标记「会了 / 再看」，进度自动保存在浏览器本地
- 键盘：`j/k` 切题、`空格` 揭晓答案

### 浏览题目

直接浏览 `content/` 目录下的 Markdown 文件（GitHub 原生渲染）。

## 题目格式

每题一个 Markdown 文件，frontmatter 记录元信息，正文分「题目 / 回答」两段。分类由**目录路径**决定。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

```markdown
---
id: go-slice-intersection
type: 手撕代码
difficulty: easy
tags: [切片, map, 交集]
sources: [gemini]
date: 2026-11-12
---

## 题目
go slice切片取交集

## 回答
...
```

## 新增题目

1. 在 `content/<一级分类>/<二级分类>/` 下新建一个 `.md`（模板见 CONTRIBUTING.md）
2. 运行 `npm run build` 重新生成 `data/questions.json` 和 `index.html`

## License

[MIT](LICENSE)
