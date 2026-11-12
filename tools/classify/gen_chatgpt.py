# -*- coding: utf-8 -*-
# 从 ChatGPT 原始 JSON（full_text）提取面试问答，按分类生成 content/**/*.md
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, 'data', 'raw', 'chatgpt', 'all.json')
CONTENT = os.path.join(ROOT, 'content')
DATE = '2026-11-12'

def clean_q(s):
    s = s.strip()
    s = re.sub(r'\s*(用时|思考了|已思考)[^\n]*$', '', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

def split_turns(text):
    parts = re.split(r'(ChatGPT 说：|你说：|GPT 说：)', text)
    turns = []
    cur = None
    buf = ''
    for p in parts:
        if p in ('你说：', 'ChatGPT 说：', 'GPT 说：'):
            if buf.strip() and cur:
                turns.append((cur, buf.strip()))
            cur = 'user' if p == '你说：' else 'assistant'
            buf = ''
        else:
            buf += p
    if buf.strip() and cur:
        turns.append((cur, buf.strip()))
    return turns

def clean_a(s):
    # 去掉行首的引用标记噪音（如 "nowcoder.com +1"、"api-cdn.nowcoder.com"）
    lines = [l for l in s.split('\n') if not re.match(r'^\s*[\w.-]+\.(com|cn|org|net)\s*(\+\d+)?\s*$', l.strip())]
    return '\n'.join(lines).strip()

# (会话标题子串, 用户问题序号, id, 一级, 二级, 题型, 难度, [tags])
M = [
    ('算法面试题与代码', 0, 'top10-algo-interview', '算法与数据结构', '数组与二分查找', '手撕代码', 'hard', ['算法', 'LeetCode', '高频', 'LRU']),
    ('资深后端模拟面试', 0, 'kafka-vs-rocketmq', '微服务与分布式', '消息队列', '概念题', 'medium', ['Kafka', 'RocketMQ']),
    ('资深后端模拟面试', 1, 'rocketmq-delay-order-cancel', '微服务与分布式', '消息队列', '场景题', 'hard', ['RocketMQ', '延迟消息', '订单']),
    ('资深后端模拟面试', 2, 'large-file-collab-memory', '系统设计', '通用设计题', '场景题', 'hard', ['内存治理', '大文件', '协同']),
    ('协议转换问题分析', 0, 'openai-anthropic-protocol', 'AI与大模型', '网关与计费', '场景题', 'hard', ['协议转换', 'OpenAI', 'Anthropic']),
    ('协议转换问题分析', 1, 'llm-gateway-observability-ha', 'AI与大模型', '网关与计费', '场景题', 'hard', ['网关', '可观测', '高可用', '性能']),
    ('K8s 部署工具对比', 0, 'kind-k8s-deploy-tools', '容器与云原生', 'Kubernetes', '概念题', 'easy', ['kind', 'Kubernetes', '部署']),
    ('测试类型及区别', 0, 'test-types-difference', '工程化与工具', '测试', '概念题', 'medium', ['单元测试', '集成测试', '端到端', '回归测试']),
    ('组织面试回答', 0, 'llm-d-oss-contribution', '面试与职业', '模拟面试', '场景题', 'medium', ['开源', 'llm-d', '项目']),
    ('llm-d-router项目介绍', 0, 'llm-d-router-intro', 'AI与大模型', '工程化', '项目题', 'medium', ['llm-d-router', '推理调度']),
    ('推荐大模型雷达网址', 2, 'agent-vs-harness', 'AI与大模型', '大模型原理', '概念题', 'medium', ['Agent', 'Harness']),
    ('栏目用途与使用方法', 1, 'function-calling-principle', 'AI与大模型', '工程化', '概念题', 'medium', ['FunctionCalling', '工具调用']),
    ('栏目用途与使用方法', 2, 'deepseek-harness-source', 'AI与大模型', '工程化', '其他', 'medium', ['Harness', '源码', 'Agent']),
    ('平台栏目与用法解读', 0, 'forward-deployed-engineer', '面试与职业', '简历与求职', '概念题', 'easy', ['FDE', '岗位']),
    ('平台栏目与用法解读', 4, 'gateway-types-comparison', 'AI与大模型', '网关与计费', '概念题', 'hard', ['Agent Gateway', 'LLM Gateway', 'Tool Gateway']),
    ('面试准备模拟', 1, 'python-framework-interview', '面试与职业', '模拟面试', '其他', 'easy', ['Python', '框架']),
    ('GitHub说服力分析', 2, 'sql-truncate', '数据库', 'MySQL', '概念题', 'easy', ['TRUNCATE', 'SQL']),
    ('求职学习与简历规划', 2, 'ai-backend-interview-points', 'AI与大模型', '工程化', '场景题', 'hard', ['限流', '超时', '重试', 'Agent']),
    ('GitHub 精选', 0, 'eval-simple-example', 'AI与大模型', '工程化', '手撕代码', 'medium', ['eval', '评测']),
    ('拓宽职业收入路径', 2, 'diy-vectorization', 'AI与大模型', '工程化', '场景题', 'medium', ['向量化', '知识库', 'embedding']),
    ('开启pprof查看内存分析', 0, 'go-pprof-memory', '工程化与工具', '性能分析', '场景题', 'medium', ['pprof', '内存', '性能']),
    ('模拟游戏后端面试', 0, 'game-backend-mock', '面试与职业', '模拟面试', '场景题', 'medium', ['游戏', '高并发', '面试']),
    ('JD产品逆向分析', 0, 'jd-product-reverse', '面试与职业', '模拟面试', '场景题', 'medium', ['JD', '逆向', '产品分析']),
    ('Temporal 与 AI 开发', 0, 'why-temporal-durable-execution', '微服务与分布式', '工作流与调度', '概念题', 'hard', ['Temporal', '持久执行', '分布式']),
    ('Temporal 与 AI 开发', 2, 'temporal-workflow-activity-worker', '微服务与分布式', '工作流与调度', '概念题', 'medium', ['Temporal', 'Workflow', 'Activity']),
    ('grep 搜索技巧', 0, 'grep-recursive-search', '工程化与工具', 'Linux命令行', '场景题', 'easy', ['grep', 'Linux']),
    ('GitLab Issue 功能介绍', 0, 'gitlab-issue-feature', '工程化与工具', 'Git', '概念题', 'easy', ['GitLab', 'Issue']),
    ('GitLab Issue 功能介绍', 1, 'git-squash', '工程化与工具', 'Git', '概念题', 'easy', ['git', 'squash']),
    ('自动化测试生成方案', 0, 'ai-test-generation', '工程化与工具', '测试', '场景题', 'medium', ['自动化测试', 'AI生成']),
]

data = json.load(open(RAW))
conv_cache = {}
for c in data:
    turns = split_turns(c['full_text'])
    conv_cache[c['title']] = turns

def find_conv(title):
    for key in conv_cache:
        if title in key or key in title:
            return conv_cache[key]
    return None

written = 0
missing = []
for title, qi, qid, cat, sub, typ, diff, tags in M:
    turns = find_conv(title)
    if turns is None:
        missing.append(title); continue
    users = [t[1] for t in turns if t[0] == 'user']
    assts = [t[1] for t in turns if t[0] == 'assistant']
    if qi >= len(users):
        missing.append(f'{title}#Q{qi}'); continue
    q = clean_q(users[qi])
    a = clean_a(assts[qi]) if qi < len(assts) else ''
    if not q:
        missing.append(f'{title}#Q{qi}'); continue
    d = os.path.join(CONTENT, cat, sub) if sub else os.path.join(CONTENT, cat)
    os.makedirs(d, exist_ok=True)
    fm = f"---\nid: {qid}\ntype: {typ}\ndifficulty: {diff}\ntags: [{', '.join(tags)}]\nsources: [chatgpt]\ndate: {DATE}\n---\n\n"
    body = f"## 题目\n{q}\n\n## 回答\n{a}\n"
    with open(os.path.join(d, qid + '.md'), 'w', encoding='utf-8') as f:
        f.write(fm + body)
    written += 1

print(f'ChatGPT 生成 {written} 个文件')
if missing:
    print('未匹配:', missing)
