---
id: ai-test-generation
type: 场景题
difficulty: medium
tags: [自动化测试, AI生成]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
你我现在有一个想法，就是目前公司都在用ai工具辅助开发，测试用例基本都是ai帮忙生成，虽然已经极大的提高了工作效率，但是还是需要每次coding的时候，做新需求或修改原有代码之后，让ai帮忙生成测试用例，需要重复告诉他基于数据、还是覆盖率达到70%以上，或者单元测试还是用例测试 等等，我需要一个方案，把自动生成测试并在每次提交代码之后自动之行做成自动化的流程，有哪些方式实现？我现在有两个已有的ai agent 一个是基于ci的和一个基于issue的 即每次提交代码之后 自动cr和简化代码 ，我的自动生成并执行测试 是否可以做到这两个项目里 还是做一个公司层面的skill？你作为一个架构师或有经验的专业高级研发 帮我想一下实现方案

## 回答
ChatGPT可以做，而且不建议只做成某个项目里的小功能。更合理的是：公司级 Test Skill / Test Agent 能力 + 接入现有 CI Agent 和 Issue Agent。也就是说：测试生成能力本身独立沉淀为公司级能力，但触发入口可以复用你现有的两个 Agent。1. 先给结论：推荐架构最推荐方案纯文本代码提交 / PR / Issue
        │
        ▼
现有 CI Agent / Issue Agent
        │
        ▼
调用公司级 Test Skill
        │
        ├── 分析变更代码
        ├── 识别测试类型
        ├── 生成/补充测试用例
        ├── 执行测试
        ├── 统计覆盖率
        ├── 修复失败测试
        └── 输出报告 / 提交补丁 / 阻断合并核心原则：能力放在哪里自动生成测试的规则、Prompt、策略公司级 Test Skill每次提交后自动触发CI Agent根据需求/Issue 生成测试计划Issue Agent覆盖率门禁、执行测试、报告CI Pipeline / CI Agent自动 CR、简化代码保留在现有 CI Agent2. 为什么不建议只放进现有 CI Agent？你的 CI Agent 现在职责是：自动 CR简化代码提交后分析代码质量如果把“测试生成”也塞进去，短期能跑，但长期会变成：纯文本CI Agent = CR + 重构 + 生成测试 + 执行测试 + 修测试 + 覆盖率策略 + 项目规则职责会过重，后续难维护。更好的方式是：纯文本CI Agent：负责触发和编排
Test Skill：负责测试生成和执行策略这样以后别的系统也可以调用 Test Skill，比如：Issue AgentIDE 插件Claude Code / Cursor / GoLand Agent本地 pre-commitPR Botnightly regression job3. 三种实现方式对比方案 A：直接增强 CI Agent纯文本每次 PR / commit 后，CI Agent 直接生成测试并执行优点：实现最快和现有提交流程结合紧容易做 PR 评论和门禁缺点：CI Agent 职责膨胀很难复用到 Issue、IDE、本地开发不同项目规则会堆在 CI Agent 里适合：MVP先验证可行性小团队快速试点方案 B：增强 Issue Agent纯文本Issue 创建/变更时，Issue Agent 生成测试计划和测试用例草案优点：测试设计更靠近需求阶段可以生成验收测试、接口测试、场景测试能提前发现需求不清缺点：不能保证代码最终实现和测试一致仍然需要 CI 阶段重新校验不适合作为唯一入口适合：需求验收测试BDD / Given-When-Then接口测试用例测试计划生成方案 C：公司级 Test Skill纯文本独立建设 Test Skill，CI Agent / Issue Agent / IDE 都调用它优点：可复用可治理可配置可沉淀团队标准更适合公司级推广缺点：初期设计成本稍高需要定义规范、接口、配置适合：长期方案多项目、多语言、多团队想把测试能力产品化我建议你走 C，但用 A 做第一阶段落地。4. 推荐分层架构4.1 Test Skill 内部模块纯文本Test Skill
├── Change Analyzer        # 变更代码分析
├── Context Builder        # 收集上下文
├── Test Strategy Planner  # 测试策略规划
├── Test Generator         # 生成测试代码
├── Test Runner            # 执行测试
├── Coverage Analyzer      # 覆盖率分析
├── Failure Fixer          # 失败测试修复
├── Report Generator       # 输出报告
└── Policy Engine          # 公司级规则5. 自动化流程设计流程一：提交代码后自动生成测试纯文本开发者提交代码
    ↓
CI 触发
    ↓
分析 diff
    ↓
判断是否需要补测试
    ↓
生成测试文件
    ↓
执行测试
    ↓
统计覆盖率
    ↓
失败则让 AI 修复一次或两次
    ↓
生成 PR 评论
    ↓
必要时阻断合并6. 关键判断逻辑不是每次提交都盲目生成测试。要先判断：需要生成测试的情况新增函数修改核心业务逻辑修改接口行为修改数据处理逻辑修改权限、支付、订单、状态机修复 bug覆盖率下降Issue 标记为 needs-test不需要生成测试的情况注释修改日志文案修改配置微调README 修改纯格式化无业务逻辑变更7. 测试类型策略你可以把测试生成策略配置化。例如：YAMLtest_policy:
  default_coverage: 70
  critical_coverage: 85

  test_types:
    unit: true
    integration: true
    api: true
    e2e: false

  rules:
    - path: "internal/service/**"
      test_type: "unit"
      min_coverage: 80

    - path: "internal/handler/**"
      test_type: "api"
      min_coverage: 70

    - path: "internal/repository/**"
      test_type: "integration"
      min_coverage: 65

    - path: "payment/**"
      test_type: "unit+integration"
      min_coverage: 90这就解决你说的重复表达问题：不用每次告诉 AI：基于数据、覆盖率 70%、单测还是用例测试。这些沉淀成项目级或公司级策略。8. Prompt 不应该每次手写，而是产品化你现在的问题本质不是“怎么写 Prompt”，而是：把 Prompt 变成可配置、可复用、可执行的工程能力。可以沉淀成几类模板：单元测试模板纯文本你是资深后端测试工程师。
请基于以下 diff、项目测试规范、已有测试风格，为变更代码补充单元测试。
要求：
1. 优先覆盖新增/修改逻辑
2. 保持与现有测试风格一致
3. 不修改业务代码
4. 覆盖正常路径、边界路径、异常路径
5. 测试可独立运行
6. 覆盖率不得低于配置阈值接口测试模板纯文本请基于接口定义、handler 逻辑、请求参数、响应结构生成 API 测试。
要求覆盖：
1. 正常请求
2. 参数缺失
3. 参数非法
4. 权限失败
5. 依赖服务异常回归测试模板纯文本请根据本次 bug 修复生成回归测试。
测试必须能在修复前失败，在修复后通过。9. 和现有两个 Agent 的关系CI Agent 应该做什么？CI Agent 适合做：监听 PR / commit获取 diff调用 Test Skill执行测试输出 PR 评论阻断合并自动提交测试代码 commit它不应该深度内置测试生成规则。Issue Agent 应该做什么？Issue Agent 适合做：根据需求生成测试计划识别验收标准生成 Given-When-Then标记哪些模块需要测试在开发前生成测试建议在 Issue 关闭前检查测试是否存在例如：纯文本Issue Agent 输出：
- 需要新增单元测试：OrderService.CreateOrder
- 需要新增接口测试：POST /orders
- 需要覆盖场景：
  1. 库存充足
  2. 库存不足
  3. 重复提交
  4. 用户无权限
  5. 支付失败然后 CI Agent 在代码提交后验证这些测试是否真的存在。10. 公司级 Test Skill 应该包含什么？10.1 公司测试规范例如：纯文本- Go 项目使用 testing + testify
- Mock 使用 gomock
- HTTP 测试使用 httptest
- DB 测试优先使用 testcontainer
- 单元测试文件命名：xxx_test.go
- 每个 service 至少覆盖正常、异常、边界三类路径
- 核心业务覆盖率不低于 80%
- 普通模块不低于 70%10.2 项目适配器不同项目可能不同：纯文本Go 项目
├── go test ./...
├── go test -coverprofile=coverage.out ./...
├── go tool cover -func=coverage.out

Python 项目
├── pytest
├── pytest --cov

Node 项目
├── npm test
├── jest --coverage所以 Test Skill 要有 adapter：纯文本Test Adapter
├── GoAdapter
├── PythonAdapter
├── NodeAdapter
├── JavaAdapter
└── CustomAdapter11. 推荐 MVP 版本第一阶段不要做太大。建议先做这个：MVP 目标在 PR 创建或更新时，自动为变更代码生成单元测试，执行测试，覆盖率低于阈值则 PR 评论提醒。MVP 流程纯文本PR opened / synchronize
    ↓
获取 diff
    ↓
识别变更函数
    ↓
查找已有测试
    ↓
生成测试补丁
    ↓
运行 go test ./...
    ↓
运行覆盖率
    ↓
失败则 AI 修复一次
    ↓
输出 PR 评论第一版先不自动合并测试代码建议先采用：纯文本AI 生成 patch → PR 评论展示 → 开发者确认后应用等稳定后再支持：纯文本AI 自动 commit 到当前 PR 分支12. 最重要的风险点1. AI 生成“看起来有测试，实际没价值”的测试典型问题：只测试 mock 行为不测业务断言为了通过测试而适配实现覆盖率上去了，缺陷发现能力没上去解决：纯文本要求测试必须包含业务断言，而不是只 assert nil。
要求覆盖：
- 正常路径
- 异常路径
- 边界路径
- 回归路径2. 自动修改测试可能引入噪音建议：初期只生成建议后期只对低风险模块自动提交核心模块必须人工确认3. 覆盖率 70% 不是唯一指标覆盖率只能说明代码被执行，不代表测得好。建议同时看：纯文本- 新增代码覆盖率
- 关键分支覆盖率
- 异常路径覆盖
- bug 回归测试是否存在
- 核心业务断言数量13. 推荐最终形态纯文本公司级 AI Testing Platform
├── Test Skill
│   ├── 单元测试生成
│   ├── 接口测试生成
│   ├── 回归测试生成
│   ├── 覆盖率分析
│   └── 失败自动修复
│
├── CI Agent 接入
│   ├── PR 触发
│   ├── 执行测试
│   ├── 覆盖率门禁
│   └── PR 评论
│
├── Issue Agent 接入
│   ├── 测试计划
│   ├── 验收标准
│   └── 测试场景
│
└── IDE / 本地 CLI 接入
    ├── 开发中生成测试
    ├── 提交前检查
    └── 快速修复失败测试14. 我给你的决策建议短期把能力先接到 CI Agent 里，做 MVP：纯文本提交后自动分析 diff → 生成测试建议 → 执行测试 → PR 评论中期把生成测试的 Prompt、规则、覆盖率策略抽出来，做成：纯文本Test Skill长期让：纯文本CI Agent 调 Test Skill
Issue Agent 调 Test Skill
IDE 调 Test Skill15. 一句话方案你应该做的不是“给某个 Agent 加一个生成测试功能”，而是建设一个公司级 AI Test Skill，由现有 CI Agent 负责编排触发，由 Issue Agent 负责需求侧测试设计，最终形成从需求、编码、提交、测试、覆盖率到 PR 反馈的自动化闭环。  6月18日周四 11:10
