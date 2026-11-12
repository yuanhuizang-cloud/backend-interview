---
id: token-bucket-param-tuning
type: 概念题
difficulty: medium
tags: [令牌桶, 限流, 速率]
sources: [gemini]
date: 2026-11-12
---

## 题目
令牌童桶法的速率 桶大小 一般该怎么设置 在工程落地上 如何配置

## 回答
在大模型网关（LLM Gateway）中，针对多租户进行资源隔离与成本管控，核心需要解决两个维度的限流与拦截：

实时频控 (Rate Limiting)：通过令牌桶（Token Bucket）算法，限制租户在短时间内的请求并发数 RPM (Requests Per Minute) 和 Token 吞吐量 TPM (Tokens Per Minute)。

动态预算控制 (Budget Controller)：基于内存/Redis 维护每个租户在周期内（如按天/按月）消耗的累计费用（Cost Bucket），在发送大模型请求前进行配额校验，并在收到响应/流式结束时原子扣减配额。

以下是用 Go 语言实现的一个高性能、并发安全的多租户 TPM/RPM 限流与动态预算控制器核心代码实现。

Go 核心代码实现
Go
package gateway

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

// ==========================================
// 1. 错误定义
// ==========================================

var (
	ErrRPMExceeded    = errors.New("429 Too Many Requests: RPM (Requests Per Minute) limit exceeded")
	ErrTPMExceeded    = errors.New("429 Too Many Requests: TPM (Tokens Per Minute) limit exceeded")
	ErrBudgetExceeded = errors.New("403 Forbidden: Daily budget quota exceeded")
)

// ==========================================
// 2. 数据结构定义
// ==========================================

// TenantPolicy 定义租户的限流与预算策略
type TenantPolicy struct {
	TenantID    string  `json:"tenant_id"`
	MaxRPM      float64 `json:"max_rpm"`       // 每分钟最大请求数
	MaxTPM      float64 `json:"max_tpm"`       // 每分钟最大 Token 数
	DailyBudget float64 `json:"daily_budget"`  // 每日配额预算 (美元 USD)
}

// TokenBucket 简易并发安全的令牌桶实现
type TokenBucket struct {
	capacity float64   // 桶容量
	tokens   float64   // 当前剩余令牌数
	rate     float64   // 每秒填充速率 (Limit / 60)
	lastUpdate time.Time
	mu       sync.Mutex
}

func NewTokenBucket(limitPerMinute float64) *TokenBucket {
	return &TokenBucket{
		capacity:   limitPerMinute,
		tokens:     limitPerMinute, // 初始填满
		rate:       limitPerMinute / 60.0,
		lastUpdate: time.Now(),
	}
}

// TryConsume 尝试消费 N 个令牌（非阻塞）
func (tb *TokenBucket) TryConsume(tokensToConsume float64) bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(tb.lastUpdate).Seconds()
	tb.lastUpdate = now

	// 补充令牌（不能超过桶容量）
	tb.tokens = tb.tokens + elapsed*tb.rate
	if tb.tokens > tb.capacity {
		tb.tokens = tb.capacity
	}

	// 校验并扣减
	if tb.tokens >= tokensToConsume {
		tb.tokens -= tokensToConsume
		return true
	}

	return false
}

// TenantCostTracker 租户动态预算追踪器
type TenantCostTracker struct {
	DailyBudget float64
	UsedCost    float64   // 当日已消耗费用 (USD)
	ResetAt     time.Time // 下次重置时间（次日零点）
	mu          sync.RWMutex
}

// ==========================================
// 3. MultiTenantManager 核心网关控制器
// ==========================================

type MultiTenantManager struct {
	policies     map[string]*TenantPolicy
	rpmBuckets   map[string]*TokenBucket
	tpmBuckets   map[string]*TokenBucket
	costTrackers map[string]*TenantCostTracker
	mu           sync.RWMutex
}

func NewMultiTenantManager() *MultiTenantManager {
	return &MultiTenantManager{
		policies:     make(map[string]*TenantPolicy),
		rpmBuckets:   make(map[string]*TokenBucket),
		tpmBuckets:   make(map[string]*TokenBucket),
		costTrackers: make(map[string]*TenantCostTracker),
	}
}

// RegisterTenant 注册/更新租户策略
func (m *MultiTenantManager) RegisterTenant(policy TenantPolicy) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.policies[policy.TenantID] = &policy
	m.rpmBuckets[policy.TenantID] = NewTokenBucket(policy.MaxRPM)
	m.tpmBuckets[policy.TenantID] = NewTokenBucket(policy.MaxTPM)

	now := time.Now()
	nextReset := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
	m.costTrackers[policy.TenantID] = &TenantCostTracker{
		DailyBudget: policy.DailyBudget,
		UsedCost:    0,
		ResetAt:     nextReset,
	}
}

// PreCheckRequest 请求发起前的护栏检查 (RPM, Estimated TPM, Budget)
func (m *MultiTenantManager) PreCheckRequest(ctx context.Context, tenantID string, estimatedInputTokens int) error {
	m.mu.RLock()
	rpmBucket, okRPM := m.rpmBuckets[tenantID]
	tpmBucket, okTPM := m.tpmBuckets[tenantID]
	tracker, okCost := m.costTrackers[tenantID]
	m.mu.RUnlock()

	if !okRPM || !okTPM || !okCost {
		return fmt.Errorf("租户 %s 未注册或策略失效", tenantID)
	}

	// 1. 检查 RPM (消耗 1 个请求令牌)
	if !rpmBucket.TryConsume(1) {
		return ErrRPMExceeded
	}

	// 2. 检查 TPM (预先扣减 Prompt 的估算 Token)
	if !tpmBucket.TryConsume(float64(estimatedInputTokens)) {
		return ErrTPMExceeded
	}

	// 3. 检查动态预算 (Budget Check)
	tracker.mu.Lock()
	defer tracker.mu.Unlock()

	// 自动重置每日配额（次日零点）
	if time.Now().After(tracker.ResetAt) {
		tracker.UsedCost = 0
		now := time.Now()
		tracker.ResetAt = time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
	}

	if tracker.UsedCost >= tracker.DailyBudget {
		return ErrBudgetExceeded
	}

	return nil
}

// PostRecordCost 请求完成或流式结束后的精确计费扣减
// promptTokens/completionTokens 来自实际计费或 Tiktoken 计算
func (m *MultiTenantManager) PostRecordCost(tenantID string, modelName string, promptTokens, completionTokens int) error {
	m.mu.RLock()
	tracker, okCost := m.costTrackers[tenantID]
	m.mu.RUnlock()

	if !okCost {
		return fmt.Errorf("未找到租户 %s 的计费追踪器", tenantID)
	}

	// 计算具体费用（以 GPT-4o 为例：Input $2.50 / 1M, Output $10.00 / 1M）
	cost := CalculateCost(modelName, promptTokens, completionTokens)

	tracker.mu.Lock()
	defer tracker.mu.Unlock()
	tracker.UsedCost += cost

	fmt.Printf("[Billing] 租户 [%s] 成功扣减费用: $%.6f, 当日累计已用: $%.4f / $%.2f\n",
		tenantID, cost, tracker.UsedCost, tracker.DailyBudget)

	return nil
}

// CalculateCost 简易模型单价计算器
func CalculateCost(model string, promptTokens, completionTokens int) float64 {
	var promptPricePerToken, completionPricePerToken float64

	switch model {
	case "gpt-4o":
		promptPricePerToken = 2.50 / 1_000_000.0
		completionPricePerToken = 10.00 / 1_000_000.0
	case "claude-3-5-sonnet":
		promptPricePerToken = 3.00 / 1_000_000.0
		completionPricePerToken = 15.00 / 1_000_000.0
	default: // 默认基础定价
		promptPricePerToken = 1.00 / 1_000_000.0
		completionPricePerToken = 2.00 / 1_000_000.0
	}

	return (float64(promptTokens) * promptPricePerToken) + (float64(completionTokens) * completionPricePerToken)
}

// ==========================================
// 4. 模拟网关请求主流程入口
// ==========================================

func main() {
	manager := NewMultiTenantManager()

	// 1. 注册租户 A (RPM: 60, TPM: 10,000, 每日预算: $0.05)
	manager.RegisterTenant(TenantPolicy{
		TenantID:    "tenant_team_alpha",
		MaxRPM:      60,
		MaxTPM:      10000,
		DailyBudget: 0.05, // 设定较小的预算以便测试拦截
	})

	ctx := context.Background()
	tenantID := "tenant_team_alpha"
	model := "gpt-4o"

	// 模拟连续并发请求
	for i := 1; i <= 5; i++ {
		fmt.Printf("\n--- 发起第 %d 次请求 ---\n", i)
		estimatedPromptTokens := 1500

		// A. 前置限流与配额校验
		err := manager.PreCheckRequest(ctx, tenantID, estimatedPromptTokens)
		if err != nil {
			fmt.Printf("[网关拦截 ❌] 租户 [%s] 请求被拒绝: %v\n", tenantID, err)
			continue
		}

		fmt.Printf("[网关通过 ✅] 租户 [%s] 校验通过，正在转发给大模型...\n", tenantID)

		// B. 模拟大模型实际响应返回的 Token 数
		actualPromptTokens := 1520
		actualCompletionTokens := 800

		// C. 后置精确扣减与计费落盘
		_ = manager.PostRecordCost(tenantID, model, actualPromptTokens, actualCompletionTokens)
	}
}

生产级落地的核心设计要点

分布式锁与 Redis 演进：

上述内存代码展示了核心算法结构。在生产环境下（分布式多节点网关），TokenBucket 和 CostTracker 应下沉至 Redis + Lua 脚本。使用 Lua 脚本可保证“读取-计算-扣减-过期时间”整个过程的原子性，防止并发超扣。

两阶段预扣与多退少补 (Two-Phase Reserve)：

针对生成长度不确定的请求（如 max_tokens=4096），在 PreCheck 时先预扣除上限额度，防止请求中途导致严重超支；在流式响应结束 ([DONE]) 时，再根据实际生成的 Token 数进行多退少补。

软限制与硬限制 (Soft & Hard Limits)：

Hard Limit（硬限制）：达到 100% 预算直接抛出 403 拒绝服务；

Soft Limit（软限制）：达到 80% 预算时异步向钉钉/飞书推送预警通知给租户负责人，实现优雅防护。
