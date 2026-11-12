# -*- coding: utf-8 -*-
# 从 Gemini 原始 JSON 提取面试问答，按分类生成 content/**/*.md
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, 'data', 'raw', 'gemini', 'all.json')
CONTENT = os.path.join(ROOT, 'content')
DATE = '2026-11-12'

def clean_q(s):
    return re.sub(r'^\s*(你说|You said|您说)\s*[:：]?\s*', '', s).strip()

# 每个条目：(会话标题, 用户问题序号q_index, id, 一级, 二级, 题型, 难度, [tags])
M = [
    # 有序数组绝对值最小首个下标二分查找
    ('有序数组绝对值最小首个下标二分查找', 0, 'bisect-abs-min-idx', '算法与数据结构', '数组与二分查找', '手撕代码', 'medium', ['二分查找','数组','有序']),
    ('有序数组绝对值最小首个下标二分查找', 2, 'istio-envoy-servicemesh-sidecar', '微服务与分布式', 'RPC与服务网格', '概念题', 'medium', ['Istio','Envoy','ServiceMesh','Sidecar']),
    ('有序数组绝对值最小首个下标二分查找', 3, 'envoy-lb-http2-limiter-fuse', '微服务与分布式', 'RPC与服务网格', '场景题', 'hard', ['Envoy','负载均衡','限流','熔断','HTTP/2']),
    ('有序数组绝对值最小首个下标二分查找', 4, 'envoy-vs-app-resilience', '微服务与分布式', 'RPC与服务网格', '场景题', 'hard', ['Envoy','熔断','限流','超时']),
    ('有序数组绝对值最小首个下标二分查找', 5, 'grpc-lb-db-pool-scale', '微服务与分布式', 'RPC与服务网格', '场景题', 'hard', ['gRPC','负载均衡','连接池','扩容']),
    ('有序数组绝对值最小首个下标二分查找', 6, 'rocketmq-consistency-transaction', '微服务与分布式', '消息队列', '场景题', 'hard', ['RocketMQ','一致性','事务']),
    # Go 切片
    ('Go切片按行与按列遍历性能差异', 0, 'go-slice-row-col-traversal', '编程语言', 'Go', '概念题', 'medium', ['切片','性能','缓存局部性']),
    # MySQL/PG
    ('MySQL与PostgreSQL对比及选型指南', 0, 'mysql-vs-postgresql', '数据库', '其他存储', '概念题', 'medium', ['MySQL','PostgreSQL','技术选型']),
    # 大模型网关计费
    ('大模型网关计费与面试难点解析', 0, 'llm-gateway-token-billing', 'AI与大模型', '网关与计费', '场景题', 'hard', ['网关','Token计费','面试']),
    ('大模型网关计费与面试难点解析', 1, 'go-ctx-vs-python-timeout', '编程语言', '通用语法与并发', '概念题', 'medium', ['Go','Python','context','超时']),
    ('大模型网关计费与面试难点解析', 2, 'llm-gateway-error-billing-flow', 'AI与大模型', '网关与计费', '场景题', 'hard', ['网关','错误处理','计费']),
    ('大模型网关计费与面试难点解析', 3, 'llm-provider-error-handling', 'AI与大模型', '网关与计费', '场景题', 'hard', ['网关','错误码','归因']),
    ('大模型网关计费与面试难点解析', 4, 'llm-sse-stream-token-calc', 'AI与大模型', '网关与计费', '场景题', 'hard', ['SSE','流式','Token计算']),
    # K8s
    ('Kubernetes Pod Pending 故障排查与面试指南', 0, 'k8s-pod-pending-troubleshoot', '容器与云原生', 'Kubernetes', '场景题', 'medium', ['Kubernetes','Pod','排查']),
    # MaaS / MCP 协议
    ('MaaS 的三种主要含义', 0, 'mcp-acp-ucp-protocol', 'AI与大模型', '工程化', '概念题', 'medium', ['MCP','ACP','UCP','Agent']),
    ('MaaS 的三种主要含义', 1, 'llm-prod-exception-defense', 'AI与大模型', '工程化', '场景题', 'hard', ['异常捕获','超时降级','安全防御']),
    # 游戏后端面试
    ('游戏后端面试准备与行业扫盲方案', 0, 'game-backend-interview-mock', '面试与职业', '模拟面试', '场景题', 'medium', ['游戏','高并发','面试']),
    # Go 底层面试
    ('Golang 底层面试题模拟回答', 0, 'golang-underlying-interview', '编程语言', 'Go', '八股', 'medium', ['Go','底层','面试']),
    # 大模型工程落地
    ('大模型工程落地与性能优化实战', 0, 'llm-hallucination-quality-cost', 'AI与大模型', '大模型原理', '场景题', 'hard', ['幻觉','降智','成本','质量']),
    ('大模型工程落地与性能优化实战', 1, 'llm-nli-gateway-fallback', 'AI与大模型', '工程化', '场景题', 'hard', ['NLI','熔断','降级','网关']),
    ('大模型工程落地与性能优化实战', 2, 'litellm-extend-fallback', 'AI与大模型', '工程化', '场景题', 'hard', ['LiteLLM','熔断','扩展']),
    ('大模型工程落地与性能优化实战', 3, 'discover-llm-open-source', 'AI与大模型', '工程化', '其他', 'easy', ['开源','选型']),
    # Ollama/LlamaIndex
    ('Ollama 与 LlamaIndex 关系解析', 0, 'llm-tech-stack-selection', 'AI与大模型', '工程化', '概念题', 'medium', ['Ollama','LlamaIndex','RAG','选型']),
    # Go 并发
    ('Go语言中有界队列与信号量对比', 0, 'go-bounded-queue-vs-semaphore', '编程语言', 'Go', '概念题', 'medium', ['Go','并发','信号量','有界队列']),
    ('Go语言中有界队列与信号量对比', 1, 'go-workerpool-vs-semaphore', '编程语言', 'Go', '概念题', 'medium', ['Go','并发','worker池','信号量']),
    ('Go 语言切片取交集方法', 0, 'go-slice-intersection', '编程语言', 'Go', '手撕代码', 'easy', ['切片','map','交集']),
    # 求职面试备战
    ('求职面试备战规划与建议', 0, 'go-chan-panic-cases', '编程语言', 'Go', '八股', 'medium', ['channel','panic','并发']),
    ('求职面试备战规划与建议', 1, 'cpu-bound-high-concurrency', '系统设计', '通用设计题', '场景题', 'hard', ['高并发','计算密集','性能']),
    ('求职面试备战规划与建议', 2, 'agent-infra-resource-isolation', 'AI与大模型', '工程化', '场景题', 'hard', ['Agent','资源隔离','基础设施']),
    ('求职面试备战规划与建议', 3, 'llm-tpm-rpm-budget-controller', 'AI与大模型', '网关与计费', '手撕代码', 'hard', ['限流','TPM','RPM','多租户']),
    ('求职面试备战规划与建议', 4, 'token-bucket-param-tuning', '系统设计', '通用设计题', '概念题', 'medium', ['令牌桶','限流','速率']),
    # AI 代码面试
    ('面试官问AI代码怎么回答', 0, 'interview-ai-generated-code', '面试与职业', '模拟面试', '其他', 'easy', ['AI代码','面试技巧']),
    # 面试策略
    ('面试备战与动态时间分配策略', 0, 'interview-time-allocation', '面试与职业', '简历与求职', '其他', 'easy', ['面试策略','时间分配']),
    # 副业
    ('AI时代的程序员副业野路子指南', 2, 'token-bucket-api-gateway-go', '系统设计', '通用设计题', '手撕代码', 'medium', ['令牌桶','限流','Go']),
    ('AI时代的程序员副业野路子指南', 3, 'plugin-skill-mcp-function-calling', 'AI与大模型', '工程化', '概念题', 'medium', ['MCP','FunctionCalling','Plugin','Skill']),
    # 华为OD
    ('华为 OD 岗位含义解析', 0, 'sandbox-isolation-landing', '容器与云原生', '沙箱与隔离', '场景题', 'medium', ['沙箱','隔离','容器']),
    ('华为 OD 岗位含义解析', 1, 'namespace-cgroup', '容器与云原生', '沙箱与隔离', '概念题', 'medium', ['namespace','cgroup','隔离']),
    ('华为 OD 岗位含义解析', 2, 'go-sync-usage', '编程语言', 'Go', '概念题', 'easy', ['sync','并发','锁']),
    ('华为 OD 岗位含义解析', 3, 'go-panic-recover-scope', '编程语言', 'Go', '八股', 'medium', ['panic','recover']),
    # OpenClaw/LiteLLM
    ('OpenClaw与LiteLLM的区别及配合使用', 1, 'llm-gateway-multitenant-admin', 'AI与大模型', '网关与计费', '场景题', 'medium', ['LiteLLM','多租户','管理后台']),
    # JD 逆向
    ('JD逆向模拟面试与解析', 1, 'interview-basic-questions-review', '面试与职业', '模拟面试', '场景题', 'medium', ['八股','JD','面试']),
    # Docker
    ('查看Docker中Nginx配置文件的位置', 0, 'docker-nginx-config-location', '容器与云原生', 'Docker', '场景题', 'easy', ['Docker','Nginx','配置']),
    ('查看Docker中Nginx配置文件的位置', 1, 'docker-compose-restart-service', '容器与云原生', 'Docker', '场景题', 'easy', ['Docker Compose','重启']),
    ('Fixing Docker Compose Interpolation Error', 0, 'docker-compose-interpolation', '容器与云原生', 'Docker', '场景题', 'easy', ['Docker Compose','环境变量']),
    # Dify
    ('Dify 批量上传文件解决方案', 0, 'dify-batch-upload-files', 'AI与大模型', '工程化', '场景题', 'easy', ['Dify','知识库']),
    ('Dify企业本地部署与应用指南', 0, 'dify-selfhost-deploy', 'AI与大模型', '工程化', '场景题', 'medium', ['Dify','部署','自托管']),
    ('Dify企业本地部署与应用指南', 1, 'local-llm-deploy-no-gpu', 'AI与大模型', '工程化', '场景题', 'medium', ['本地部署','大模型','无GPU']),
    # 云厂商
    ('海外公有云厂商分类盘点与选型指南', 0, 'overseas-cloud-vendors', '容器与云原生', '云平台', '概念题', 'easy', ['公有云','AWS','GCP','Azure']),
    # AI 研发平台
    ('AI研发协同平台架构与实现分析', 1, 'ai-dev-collab-platform-prd', '系统设计', '架构设计', '场景题', 'hard', ['架构','PRD','协同平台']),
    # OpenClaw 生态
    ('Pi、OMP 与 OpenClaw 关系解析', 0, 'pi-omp-openclaw', 'AI与大模型', '工程化', '概念题', 'easy', ['OpenClaw','OMP']),
]

data = json.load(open(RAW))
by_title = {}
for c in data:
    by_title.setdefault(c['title'], c)

def find_conv(title):
    for key in by_title:
        if title in key or key in title:
            return by_title[key]
    return None

written = 0
missing = []
for title, qi, qid, cat, sub, typ, diff, tags in M:
    conv = find_conv(title)
    if not conv:
        missing.append(title); continue
    users = [m['text'] for m in conv['messages'] if m['role'] == 'user']
    assts = [m['text'] for m in conv['messages'] if m['role'] == 'assistant']
    if qi >= len(users):
        missing.append(f'{title}#Q{qi}'); continue
    q = clean_q(users[qi])
    a = assts[qi].strip() if qi < len(assts) else ''
    if not q:
        missing.append(f'{title}#Q{qi}'); continue
    d = os.path.join(CONTENT, cat, sub) if sub else os.path.join(CONTENT, cat)
    os.makedirs(d, exist_ok=True)
    fm = f"---\nid: {qid}\ntype: {typ}\ndifficulty: {diff}\ntags: [{', '.join(tags)}]\nsources: [gemini]\ndate: {DATE}\n---\n\n"
    body = f"## 题目\n{q}\n\n## 回答\n{a}\n"
    with open(os.path.join(d, qid + '.md'), 'w', encoding='utf-8') as f:
        f.write(fm + body)
    written += 1

print(f'Gemini 生成 {written} 个文件')
if missing:
    print('未匹配:', missing)
