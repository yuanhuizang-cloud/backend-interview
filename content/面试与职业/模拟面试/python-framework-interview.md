---
id: python-framework-interview
type: 其他
difficulty: easy
tags: [Python, 框架]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
可以 继续吧 除了python 我感觉框架是不是也需要准备？

## 回答
是，框架需要准备，而且你这个 JD 里虽然没有点名 Gin/GORM/Flask/SQLAlchemy，但你是 8 年后端，面试官很容易从“你平时用什么框架”往下追。

但时间紧，不建议广撒网。你只需要补 4 组框架高频点：

Gin
GORM
Flask
SQLAlchemy

其中优先级我建议：

Gin > GORM > Flask > SQLAlchemy

因为你现在目标岗位主语言明显偏 Go。

下面我先把 Python 高频 8 题 + 框架高频 12 题 一起给你，项目高危追问放下一轮。

一、Python 高频 8 题
1. Python 的 GIL 是什么？
第一反应

GIL 是 CPython 解释器的一把全局锁，保证同一时刻只有一个线程执行 Python bytecode。

为什么存在？

主要是：

简化 CPython 对象内存管理和引用计数的线程安全问题。

影响

对于：

纯文本
CPU 密集型

多线程通常不能有效利用多核。

对于：

纯文本
IO 密集型

线程仍然有用，因为阻塞 IO 时通常会释放 GIL。

怎么绕开？

CPU 密集：

multiprocessing
C extension
多进程 worker

IO 密集：

threading
asyncio

一句话：

GIL 限制的是 CPython 多线程执行 Python bytecode 的并行能力，不代表 Python 不能并发。

2. Python 多线程、多进程、协程怎么选？
多线程

适合：

IO 密集，线程间共享内存方便。

缺点：

GIL
锁
race condition
多进程

适合：

CPU 密集。

优点：

真正利用多核。

缺点：

进程创建和 IPC 成本更高。

asyncio

适合：

大量高并发 IO。

本质：

单线程事件循环 + 非阻塞 IO + coroutine。

一句话记：

纯文本
CPU 密集 → 多进程
IO 中等并发 → 多线程
IO 大量并发 → asyncio
3. list 和 tuple 区别？
list
mutable
动态数组
可修改
tuple
immutable
通常更轻
如果元素都可 hash，可以作为 dict key

别说“tuple 一定比 list 快很多”，只说：

tuple 不可变，因此语义和内存布局更简单，在某些场景开销略低。

4. dict 底层是什么？

hash table。

查找平均复杂度：

纯文本
O(1)

核心：

纯文本
hash(key)
↓
定位 slot
↓
处理 collision

Python 3.7+：

dict 保持插入顺序。

追问：为什么 key 必须 hashable？

因为：

hash 值必须在对象生命周期内稳定，否则位置会变化，哈希表无法正常定位。

所以：

str
int
tuple（元素都 hashable）

可以做 key。

list 不行。

5. Python 内存管理怎么做？

你答三层：

① 引用计数

CPython 主要通过 reference counting 管理对象生命周期。

对象引用数变 0：

通常立即回收。

② 循环引用

引用计数解决不了：

纯文本
A → B
B → A

所以 CPython 还有：

cyclic GC。

③ 小对象分配器

CPython 还有 pymalloc，对小对象做内存池管理，减少频繁 malloc/free。

6. 深拷贝和浅拷贝区别？

浅拷贝：

创建新容器，但内部元素仍然引用原对象。

深拷贝：

递归复制内部对象。

例：

Python
a = [[1]]
b = copy.copy(a)

修改：

Python
b[0].append(2)

a 也会变化。

因为内层 list 共享。

7. generator 是什么？

generator 是惰性产生数据的迭代器，不会一次把所有结果加载到内存。

关键：

Python
yield

每次 yield：

保存当前执行状态，下次从这里继续。

适合：

大文件
流式数据
pipeline

这和你的文件同步场景可以关联。

8. async / await 原理是什么？

简化答：

async 定义 coroutine，await 表示当前协程等待一个异步操作，此时把执行权交回 event loop，event loop 可以继续调度其他 coroutine。

本质：

纯文本
coroutine
+
event loop
+
non-blocking IO

关键：

async 不意味着自动多线程，也不意味着 CPU 并行。

二、Gin 高频 5 题
1. Gin 为什么性能比较好？

别只说“因为 Go 快”。

可以答：

Gin 基于 net/http，路由匹配和中间件链实现比较轻量，同时大量使用对象复用和较少抽象，因此额外开销比较小。

如果追问路由：

Gin 路由底层采用 radix tree / trie 类结构做路径匹配。

2. Gin middleware 是怎么工作的？
核心

本质上是一个 handler chain。

请求进来：

纯文本
middleware1
↓
middleware2
↓
handler

常见：

Go
func Middleware(c *gin.Context) {
    // before
    c.Next()
    // after
}
c.Next()

执行后续 handler。

c.Abort()

阻止后续 handler 执行。

典型应用：

auth
logging
tracing
recovery
rate limit
3. Gin Context 能不能跨 goroutine 用？

这个非常值得记。

不能直接安全地把当前 *gin.Context 随便传给 goroutine 使用。

如果需要：

Go
cCopy := c.Copy()

或者更好的：

只提取真正需要的数据，并传标准 context.Context。

因为：

Gin Context 和当前请求生命周期绑定。

4. Gin 的 Recovery 做什么？

捕获 handler panic，避免整个 HTTP server 因单个请求 panic 崩掉，同时返回 500 并记录错误。

不过要强调：

recovery 只是最后兜底，不能替代正常错误处理。

5. Gin 和 net/http 是什么关系？

Gin 不是自己实现 TCP/HTTP server，它建立在标准库 net/http 之上，主要提供 routing、middleware、binding、rendering 等上层能力。

三、GORM 高频 4 题
1. GORM 的优缺点？

优点：

开发效率高
model mapping
association
transaction
migration
hooks

缺点：

ORM 容易隐藏真实 SQL 和性能成本。

常见坑：

N+1
自动生成 SQL 不理想
preload 数据过大
transaction 边界不清晰
update 零值行为

你最好说：

性能敏感链路我会看实际 SQL 和 EXPLAIN，而不会只停留在 ORM API 层。

2. 什么是 N+1 查询？

比如：

纯文本
查 100 个 user
↓
每个 user 再查一次 orders

最终：

纯文本
1 + 100

次 SQL。

解决：

JOIN
Preload
batch query
DataLoader 类方案
3. GORM transaction 怎么用？

常见：

Go
db.Transaction(func(tx *gorm.DB) error {
    ...
    return nil
})

返回 nil：

commit。

返回 error：

rollback。

高级一点：

transaction 要尽量缩小范围，不要在事务里做远程 RPC 或长时间 IO，否则持锁时间变长。

4. GORM 的 Save / Updates 有什么坑？

这题如果细问：

GORM 某些 update API 对零值字段处理不同，比如 struct Updates 默认可能忽略零值，而 map 可以显式更新零值。

核心不是背 API：

使用 ORM 更新数据时，要明确“哪些字段真的会生成 SQL”，关键链路最好看最终 SQL。

四、Flask 高频 4 题
1. Flask 是什么？

Flask 是 Python 的轻量级 WSGI Web framework，本身提供 routing、request/response、template 等基础能力，其他能力通过 extension 组合。

2. Flask request 为什么可以直接使用？

比如：

Python
from flask import request

它并不是普通全局变量。

Flask 通过 context local / LocalProxy，把当前 request context 中的数据暴露出来。

也就是说：

每个请求有自己的 context。

3. Flask request context 和 application context 区别？
request context

包含：

request
session

跟一次 HTTP 请求绑定。

application context

包含：

current_app
g

跟当前 Flask application 上下文绑定。

4. Flask 自己能直接抗生产流量吗？

准确答：

Flask 自带 development server 不适合生产环境。

生产通常：

纯文本
Nginx
↓
Gunicorn / uWSGI
↓
Flask

你过去用过 Gunicorn，所以这个要会。

五、SQLAlchemy 高频 3 题
1. SQLAlchemy 是 ORM 吗？

准确说：

SQLAlchemy 不只是 ORM，它包括 SQL Expression Language / Core 和 ORM 两层。

Core：

更接近 SQL abstraction。

ORM：

object-relational mapping。

2. Session 是什么？

Session 不是简单数据库连接，它更像一个 Unit of Work，管理对象状态、transaction 和数据库交互。

它内部可能从：

connection pool

获取连接。

注意

Session 通常不应该跨线程共享。

3. lazy loading 有什么坑？

最大的：

N+1。

访问 relation 时：

Python
user.orders

可能临时发 SQL。

所以需要根据场景选择：

joinedload
selectinload
eager loading
六、框架题真正考你的是什么？

对 8 年后端来说，面试官一般不满足于：

Gin 怎么绑定 JSON？

而更可能问：

为什么这样设计？
有什么坑？
线上怎么用？

所以你的框架回答最好固定成：

纯文本
机制
↓
典型使用
↓
生产风险

例如：

GORM

ORM 提高效率，但是会隐藏 SQL。

然后：

所以性能敏感接口我一定会看生成 SQL + EXPLAIN。

这就比纯背 API 好。

七、还有一个很可能问：Gunicorn

因为你 Python 经历比较长。

Gunicorn 是什么？

Gunicorn 是 Python WSGI HTTP Server，一般负责管理多个 worker process 来运行 Flask/Django 应用。

结构：

纯文本
Master
↓
Worker
Worker
Worker
为什么多进程？

一个原因：

Python GIL 限制 CPU-bound 多线程并行。

同时：

多 worker 也提供故障隔离和多核利用。

八、Gunicorn worker 类型

知道三种足够：

纯文本
sync
gthread
gevent
sync

每 worker：

同时处理一个 request。

gthread

一个 worker 内多个 thread。

gevent

cooperative coroutine + monkey patch，适合高 IO concurrency。

如果你没实际用过 gevent，不要装。

直接：

我过去主要是普通 worker 模式，gevent 的机制我了解，但没有在核心项目里重度使用。

九、今天还建议你记一个问题
“Go 的 Gin 和 Python Flask 最大区别是什么？”

不要只说性能。

可以答：

两者都是比较轻量的 Web framework，但运行时模型差别很大。

Flask 基于 Python WSGI 模型，生产环境通常配 Gunicorn，多进程/多线程模型比较常见；Gin 基于 Go net/http，一个进程内部可以通过 goroutine 高效处理大量并发连接。

所以实际做 Python→Go 重构时，收益不仅是语法或框架变化，还包括运行时并发模型、内存模型和部署资源模型变化。

这句话对你的 Python→Go 项目尤其好。

十、你现在框架部分只需要记这些
纯文本
Gin
net/http
radix tree
middleware chain
c.Next
c.Abort
Context 不随便跨 goroutine
Recovery

GORM
ORM abstraction
N+1
Preload
Transaction
零值更新
看 SQL + EXPLAIN

Flask
WSGI
request context
application context
生产配 Gunicorn

SQLAlchemy
Core + ORM
Session = Unit of Work
connection pool
lazy loading → N+1

Gunicorn
master-worker
sync/gthread/gevent
你的判断是对的：框架需要准备，但不要继续扩展

现在不要再补 Django、FastAPI、Beego、Kratos、Go-Zero。

ROI 太低。

你真正还缺的是：

项目深挖。

而且这部分比框架重要。

下一轮我建议直接做：

“你的项目高危追问 12 题”

重点会打：

Python→Go 为什么重写，不优化 Python？
怎么保证行为一致？
为什么 Pod 能下降一个数量级？
OOM 到底根因是什么？
5000 万文件同步怎么保证不丢不重？
Worker Pool 怎么实现背压？
Kafka 顺序怎么保证？
commitVersion / syncVersion 区别？
为什么不用分布式锁？
Redis / DB 一致性怎么处理？
你的方案哪里是你主导？
指标怎么算出来的？

这部分是你明天最容易被问到，也是最能拉开差距的一块。

继续准备项目深挖

开始项目高危追问12题
开始框架场景题
9月9日周三 12:29
