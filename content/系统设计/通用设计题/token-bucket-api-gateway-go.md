---
id: token-bucket-api-gateway-go
type: 手撕代码
difficulty: medium
tags: [令牌桶, 限流, Go]
sources: [gemini]
date: 2026-11-12
---

## 题目
令牌桶做API网关限流的go实现 以及令牌桶原理

## 回答
一、 令牌桶算法原理（Token Bucket）

令牌桶算法（Token Bucket）是 API 网关与高并发服务中最常用的限流算法之一。它的核心思想是：以恒定速率生成令牌放入桶中，请求到来时必须从桶中拿到令牌才能被处理，拿不到则被限流（拒绝或排队）。

Plaintext
       ┌─────────────────────┐
       │  令牌生成器 (Rate)  │
       └──────────┬──────────┘
                  │ 恒定速率放入令牌 (e.g. 100/s)
                  ▼
          ┌───────────────┐
          │   令牌桶      │ ◄── 容量上限 (Capacity)
          │  ● ● ● ● ● ●  │
          └───────┬───────┘
                  │ 请求到达，尝试获取令牌 (Token)
                  ▼
         ┌─────────────────┐
    ─────► 拿到令牌？       ├─► 允许通行 (Pass)
         └────────┬────────┘
                  │ 否 (桶空)
                  ▼
             被拒绝 (429 Too Many Requests) / 延迟等待

核心要素与运作机制：

桶容量（Capacity / Burst）：桶最多能容纳的令牌数量。如果桶满了，新生成的令牌会被直接丢弃。

填充速率（Rate / Fill Rate）：单位时间内向桶中放入的令牌数（如每秒 100 个）。

获取令牌（Acquire）：每个请求进来时，尝试从桶中拿走 
𝑁
N 个令牌（通常为 1 个）。

如果桶里令牌足够：拿走令牌，放行请求。

如果桶里令牌不足：拒绝请求（返回 HTTP 429）或进入排队等待。

为什么网关最推荐令牌桶？

支持突发流量（Burst Ability）：当系统较闲时，令牌桶会被填满。如果瞬间进来大量请求（只要不超过桶容量），可以一次性把桶里的令牌拿完并全部放行，非常适合处理突发流量。

平滑限流（Smooth Rate）：长期来看，请求的平均速率会被严格限制在令牌生成速率之内。

二、 算法实现原理：性能极高的“伪填充”机制

很多新手会误以为实现令牌桶需要搞一个后台 Goroutine 和 time.Ticker 定时往桶里放令牌，但在工程实现中这是完全错误的（后台线程过多会带来巨大的 CPU 与调度开销）。

主流实现（包括 Go 官方库 golang.org/x/time/rate）采用的是惰性计算（Lazy Evaluation）/ 伪填充：

不使用后台定时器。

当有请求进来（调用 Allow() 或 Wait()）时，根据上一次请求的时间戳与当前时间的差值，动态计算出这段时间内应该补多少令牌：

新令牌数
=
min
⁡
(
桶容量
,
旧令牌数
+
Δ
𝑡
×
生成速率
)
新令牌数=min(桶容量,旧令牌数+Δt×生成速率)

扣减令牌并更新上一次时间戳，整个过程只需经过一次加锁或原子操作，性能极高。

三、 Go 原生单机版限流实现（基于官方 rate.Limiter）

Go 官方在 golang.org/x/time/rate 中提供了性能极高的单机令牌桶实现。在 API 网关中，通常需要按 IP 或 API Path / Tenant 分组限流。

下面是一个可直接在生产中运用的多维度网关中间件代码：

Go
package main

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/generic" // 示例采用 Gin 框架，也可替换为原生 net/http
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// IPRateLimiter 多租户/IP 限流管理器
type IPRateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*visitor
	r        rate.Limit // 每秒填充速率
	b        int        // 桶容量
}

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	i := &IPRateLimiter{
		limiters: make(map[string]*visitor),
		r:        r,
		b:        b,
	}

	// 定期清理长期不活跃的 IP，防止内存泄漏
	go i.cleanupVisitors()
	return i
}

// GetLimiter 获取或创建针对特定 IP 的 Limiter
func (i *IPRateLimiter) GetLimiter(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	v, exists := i.limiters[ip]
	if !exists {
		limiter := rate.NewLimiter(i.r, i.b)
		i.limiters[ip] = &visitor{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}

	v.lastSeen = time.Now()
	return v.limiter
}

// 清理超过 3 分钟未访问的 IP 记录
func (i *IPRateLimiter) cleanupVisitors() {
	for {
		time.Sleep(1 * time.Minute)
		i.mu.Lock()
		for ip, v := range i.limiters {
			if time.Since(v.lastSeen) > 3*time.Minute {
				delete(i.limiters, ip)
			}
		}
		i.mu.Unlock()
	}
}

// RateLimitMiddleware Gin 网关限流中间件
func RateLimitMiddleware(limiter *IPRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP() // 获取客户端 IP
		l := limiter.GetLimiter(ip)

		// 尝试获取 1 个令牌（非阻塞）
		if !l.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"code": 429,
				"msg":  "Too Many Requests - 请求过于频繁，请稍后再试",
			})
			c.Abort() // 阻断后续处理器执行
			return
		}

		c.Next()
	}
}

func main() {
	r := gin.Default()

	// 限制每个 IP 每秒生成 5 个令牌，桶最大容量为 10（允许最多 10 个突发并发）
	limiter := NewIPRateLimiter(rate.Limit(5), 10)

	r.Use(RateLimitMiddleware(limiter))

	r.GET("/api/v1/resource", func(c *gin.Context) {
		c.JSON(200, gin.H{"data": "success"})
	})

	r.Run(":8080")
}

四、 分布式 API 网关限流实现（Redis + Lua 脚本）

在微服务集群中，网关往往是多实例部署的。单机版 Limiter 无法限制集群的总流量，必须借助 Redis + Lua 脚本 实现多网关共享的分布式令牌桶。

使用 Lua 脚本的原因：保证 Redis 内部“计算差值 - 补令牌 - 扣减令牌”这一系列操作的原子性。

1. Redis 令牌桶 Lua 脚本 (rate_limiter.lua)
Lua
-- KEYS[1]: 限流标识 Key (例如 rate_limit:ip:192.168.1.1)
-- ARGV[1]: 桶容量 (Capacity)
-- ARGV[2]: 填充速率 (Tokens per second)
-- ARGV[3]: 当前时间戳 (Unix timestamp in seconds)
-- ARGV[4]: 本次请求消耗的令牌数 (通常为 1)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local fill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

-- 获取当前桶内状态
local ttl = math.ceil(capacity / fill_rate) * 2 -- 设置过期时间，防止冷 key 永久占用内存
local data = redis.call('HMGET', key, 'tokens', 'last_updated')

local tokens = tonumber(data[1])
local last_updated = tonumber(data[2])

if tokens == nil then
    -- 首次访问，初始化桶为满令牌状态
    tokens = capacity
    last_updated = now
else
    -- 计算自上次访问后新生成的令牌数
    local delta = math.max(0, now - last_updated)
    tokens = math.min(capacity, tokens + delta * fill_rate)
    last_updated = now
end

-- 判断令牌是否足够
if tokens >= requested then
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_updated', last_updated)
    redis.call('EXPIRE', key, ttl)
    return 1 -- 放行
else
    -- 令牌不足，保存更新后的状态，拒绝请求
    redis.call('HMSET', key, 'tokens', tokens, 'last_updated', last_updated)
    redis.call('EXPIRE', key, ttl)
    return 0 -- 拒绝
end

2. Go 语言分布式限流代码调用
Go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

var luaScript = redis.NewScript(`
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local fill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local ttl = math.ceil(capacity / fill_rate) * 2
local data = redis.call('HMGET', key, 'tokens', 'last_updated')

local tokens = tonumber(data[1])
local last_updated = tonumber(data[2])

if tokens == nil then
    tokens = capacity
    last_updated = now
else
    local delta = math.max(0, now - last_updated)
    tokens = math.min(capacity, tokens + delta * fill_rate)
    last_updated = now
end

if tokens >= requested then
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_updated', last_updated)
    redis.call('EXPIRE', key, ttl)
    return 1
else
    redis.call('HMSET', key, 'tokens', tokens, 'last_updated', last_updated)
    redis.call('EXPIRE', key, ttl)
    return 0
end
`)

type RedisRateLimiter struct {
	rdb *redis.Client
}

func NewRedisRateLimiter(rdb *redis.Client) *RedisRateLimiter {
	return &RedisRateLimiter{rdb: rdb}
}

// Allow 校验是否放行
func (r *RedisRateLimiter) Allow(ctx context.Context, key string, capacity int, ratePerSec int) (bool, error) {
	now := time.Now().Unix()
	
	// 执行 Lua 脚本
	res, err := luaScript.Run(ctx, r.rdb, []string{key}, capacity, ratePerSec, now, 1).Result()
	if err != nil {
		return false, err
	}

	return res.(int64) == 1, nil
}

func main() {
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	limiter := NewRedisRateLimiter(rdb)
	ctx := context.Background()

	// 模拟针对某个用户/IP 进行限流：桶容量 10，每秒生成 2 个令牌
	apiKey := "rate_limit:user:1001"

	for i := 0; i < 15; i++ {
		allowed, err := limiter.Allow(ctx, apiKey, 10, 2)
		if err != nil {
			fmt.Println("Error:", err)
			return
		}
		if allowed {
			fmt.Printf("Req %d: Pass\n", i+1)
		} else {
			fmt.Printf("Req %d: Limited (429)\n", i+1)
		}
	}
}

五、 两种方案选型与工程总结
维度	单机版（x/time/rate）	分布式版（Redis + Lua）
性能	极高（纳秒级，只占用本机内存）	较高（受限于 Redis 网络 RTT 交互）
准确度	只能限制单台网关节点，节点扩容会导致总 QPS 变大	跨集群全局精准限流
复杂度	极简，无需依赖外部组件	需要维护 Redis 集群及 Lua 脚本
适用场景	保护网关单机节点不崩溃，或单体架构	保护微服务后端整体数据库与核心 API

💡 工程落地最佳建议：
在大型 API 网关（如 APISIX、Kong 或自研网关）中，通常采用两层组合限流策略：

第一层（单机防护）：使用本地 Go rate.Limiter 设置极高的硬上限（如单机 10000 QPS），保护网关单实例自身内存和 CPU 不被冲垮。

第二层（全局业务限流）：使用 Redis + Lua 设置业务维度（如按 API Key / 租户）的分布式限流，保护下游微服务与数据库。
