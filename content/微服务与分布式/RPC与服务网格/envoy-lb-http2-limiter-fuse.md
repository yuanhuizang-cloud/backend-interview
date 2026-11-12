---
id: envoy-lb-http2-limiter-fuse
type: 场景题
difficulty: hard
tags: [Envoy, 负载均衡, 限流, 熔断, HTTP/2]
sources: [gemini]
date: 2026-11-12
---

## 题目
具体应该如何通过envoy做负载均衡、http/2解析、限流和熔断？通过代码、配置等辅助讲解帮助我理解和掌握

## 回答
Envoy 作为现代云原生架构中最核心的流量代理（Data Plane），能够在一层代理中完美解决负载均衡、HTTP/2 多路复用解耦、限流、熔断等核心网关治理能力。

Envoy 的配置主要基于 xDS 动态配置协议，但为了直观理解，我们通常使用其静态 YAML 配置文件（envoy.yaml）来讲解。

一、 Envoy 核心概念复习（理解配置的基础）

Envoy 的核心配置分为四大支柱：

Listeners（监听器）：负责监听外部发来的请求（类似 Nginx 的 server 块）。

Routes（路由）：定义路由规则，将不同的 HTTP 路径转发给不同的集群。

Clusters（集群/后端）：定义后端的真实服务实例列表（服务发现）、负载均衡策略以及熔断、健康检查。

Filters（过滤器链）：Envoy 的灵魂。网络层和 HTTP 层的各种增强功能（如限流、鉴权、日志）都是通过一层层 Filter 叠加实现的。

二、 完整 envoy.yaml 配置文件示例

下面是一份整合了负载均衡、HTTP/2解析、限流、熔断的 Envoy 静态配置文件。

YAML
static_resources:
  listeners:
  - name: grpc_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 10000 # Envoy 对外暴露的端口
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: grpc_app
          
          # 【1. HTTP/2 解析支持】
          # Envoy 的 HttpConnectionManager 默认支持自动升级和解析 HTTP/1.1 和 HTTP/2。
          # 对于 gRPC 流量，它天然识别 HTTP/2 并能解构出内部的 Stream (RPC 请求)。
          codec_type: AUTO 

          route_config:
            name: local_route
            virtual_hosts:
            - name: local_service
              domains: ["*"]
              routes:
              - match:
                  prefix: "/" # 拦截所有请求
                route:
                  cluster: my_grpc_backend_cluster
                  timeout: 0s # gRPC 通常设为 0（由具体 RPC 决定超时）

          http_filters:
          # 【2. 限流 Filter 配置】
          - name: envoy.filters.http.local_throttler # 本地限流过滤器
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.local_ratelimit.v3.LocalRateLimit
              stat_prefix: http_local_rate_limiter
              token_bucket:
                max_tokens: 100          # 令牌桶最大容量
                tokens_per_fill: 50      # 每次填充数量
                fill_interval: 1s        # 每秒补充一次（即限制最大每秒 50 个请求）
              filter_enabled:
                runtime_key: local_rate_limit_enabled
                default_value:
                  numerator: 100
                  denominator: HUNDRED
              filter_enforced: true

          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router

  clusters:
  - name: my_grpc_backend_cluster
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN # 【3. 负载均衡策略】配置为轮询
    http2_protocol_options: {} # 声明与后端也使用 HTTP/2 通信（gRPC 必须）
    
    # 【4. 熔断与并发限制（Circuit Breakers）】
    circuit_breakers:
      thresholds:
      - priority: DEFAULT
        max_connections: 1024      # 最大并发 TCP 连接数
        max_pending_requests: 100  # 最大等待队列中的请求数
        max_requests: 1000         # 最大并发活跃请求数（超过此数触发熔断拒绝）
        max_retries: 3             # 最大重试次数

    load_assignment:
      cluster_name: my_grpc_backend_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend-service-1
                port_value: 50051
        - endpoint:
            address:
              socket_address:
                address: backend-service-2
                port_value: 50051

三、 核心功能点深度拆解
1. 负载均衡（Load Balancing）怎么做？

配置位置：在 clusters 下配置 lb_policy: ROUND_ROBIN。

Envoy 是怎么干的：
传统的四层负载均衡（如 L4 Proxy）因为不认识 HTTP/2，只会把所有请求卡在同一条 TCP 长连接上。
而 Envoy 开启了 http2_protocol_options: {} 之后，它会主动与后端多个 Pod 建立多条长连接。当成千上万个 gRPC Stream（RPC 请求）涌入 Envoy 时，Envoy 作为一个 L7 代理，会拆开每一个 Stream，并根据 ROUND_ROBIN（轮询）或 LEAST_REQUEST（最少连接）策略，将不同的 Stream 均匀分发到不同的后端 TCP 连接上去。

2. HTTP/2 解析怎么做？

配置位置：codec_type: AUTO。

Envoy 是怎么干的：
Envoy 在 HttpConnectionManager 中内置了现代化的 HTTP 编解码器。当客户端发起请求时，Envoy 会自动检测并建立 HTTP/2 帧传输。由于 gRPC 是基于 HTTP/2 构建的，Envoy 能够原生识别 gRPC 的二进制帧结构、Header、Data 帧以及 Trailers（状态码如 grpc-status: 0），从而能够对单个 gRPC 方法（例如 /users.UserService/GetUser）进行精细化路由和治理。

3. 限流（Rate Limiting）怎么做？

配置位置：在 http_filters 中配置 envoy.filters.http.local_throttler（本地限流）。

Envoy 是怎么干的：
Envoy 内置了令牌桶算法（Token Bucket）。上述配置中定义了 max_tokens: 100，每秒补充 50 个。

如果瞬时流量过大，超出令牌桶限制，Envoy 会直接拦截该请求，并返回标准的 HTTP 429 Too Many Requests（或者对于 gRPC 返回状态码 RESOURCE_EXHAUSTED）。

注：生产环境中如果有多台 Envoy 实例，通常会配合外部的集中式限流服务（Rate Limit Service）实现分布式全局限流。

4. 熔断（Circuit Breakers）怎么做？

配置位置：在 clusters 下配置 circuit_breakers。

Envoy 是怎么干的：
Envoy 的熔断是被动保护后端服务的机制，主要通过限制资源的消耗来防止雪崩：

max_requests: 1000：如果当前后端集群同时处理的活跃请求数超过了 1000，新来的请求会被 Envoy 直接拒绝（返回 503 Service Unavailable 或 gRPC 的 UNAVAILABLE），保护后端不会被压垮。

max_pending_requests: 100：当连接满时，允许排队等待的最大请求数。

四、 如何通过命令行启动和测试 Envoy？
1. 启动 Envoy 容器

你可以将上面的 YAML 保存为 envoy.yaml，然后通过 Docker 快速启动：

Bash
docker run --name my-envoy -d \
  -v $(pwd)/envoy.yaml:/etc/envoy/envoy.yaml \
  -p 10000:10000 \
  envoyproxy/envoy:v1.28.0

2. 客户端请求验证

启动后，客户端不需要直连后端具体的 backend-service-1 或 backend-service-2，而是统一把请求打到 Envoy 的端口（localhost:10000）。

Envoy 会自动帮你做 HTTP/2 解析。

按照配置执行限流和熔断检查。

最终通过 ROUND_ROBIN 均匀分发到后端的多个实例中。
