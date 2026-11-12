---
id: go-sync-usage
type: 概念题
difficulty: easy
tags: [sync, 并发, 锁]
sources: [gemini]
date: 2026-11-12
---

## 题目
介绍一下go sync的用法

## 回答
Go 语言遵循“不要通过共享内存来通信，而要通过通信来共享内存”的原则。但在高并发性能要求极高的底层开发中，sync 包提供的基础同步原语依然必不可少。

下面介绍 sync 包中最核心的组件及其典型应用场景：

1. sync.WaitGroup（等待一组协程完成）

用于阻塞当前协程，直到启动的一组并发任务全部完成。

常用方法：

Add(delta int)：增加计数器。

Done()：计数器减 1（通常用 defer wg.Done()）。

Wait()：阻塞等待，直到计数器变为 0。

Go
var wg sync.WaitGroup

for i := 0; i < 3; i++ {
    wg.Add(1)
    go func(id int) {
        defer wg.Done()
        fmt.Printf("Worker %d finished\n", id)
    }(i)
}

wg.Wait() // 等待所有 worker 退出

2. sync.Mutex 与 sync.RWMutex（互斥锁与读写锁）

保护共享资源，避免竞态条件（Race Condition）。

sync.Mutex：排他锁，同一时刻仅允许一个协程持有锁。

sync.RWMutex：读写分离锁。允许多个协程同时读取（RLock / RUnlock），但写操作（Lock / Unlock）是互斥的，适合读多写少的场景。

Go
type SafeCounter struct {
    mu    sync.RWMutex
    stats map[string]int
}

func (c *SafeCounter) Get(key string) int {
    c.mu.RLock()         // 加读锁
    defer c.mu.RUnlock()
    return c.stats[key]
}

func (c *SafeCounter) Incr(key string) {
    c.mu.Lock()          // 加写锁
    defer c.mu.Unlock()
    c.stats[key]++
}

3. sync.Once（单例 / 延迟加载）

保证传入的函数在程序运行期间仅被执行一次，且并发安全。常用于配置加载、连接池初始化等单例模式。

Go
var (
    instance *Config
    once     sync.Once
)

func GetConfig() *Config {
    once.Do(func() {
        // 即使有 1000 个协程同时调用，此代码段也只会在首次调用时执行一次
        instance = loadConfigFromDisk()
    })
    return instance
}

4. sync.Map（并发安全 Map）

Go 原生的 map 并发读写会直接引发致命错误（fatal error: concurrent map writes）。sync.Map 是官方提供的并发安全 Map，开箱即用，无需显式加锁。

适用场景：

读多写少（极高频读取、极低频写入）。

多个协程读写各不相同的 key。

常用 API：Store、Load、LoadOrStore、Delete、Range。

Go
var m sync.Map

// 写入
m.Store("user_100", "Alice")

// 读取
if val, ok := m.Load("user_100"); ok {
    fmt.Println(val.(string))
}

// 存在即读取，不存在则写入（原子操作）
actual, loaded := m.LoadOrStore("user_101", "Bob")

5. sync.Pool（对象复用与 GC 优化）

内存池机制，用于缓存已被分配但暂时未使用的对象，从而降低 GC（垃圾回收）压力，提升高并发性能。

注意：sync.Pool 中的对象随时可能在 GC 触发时被清空，不能用于存放有状态/需要持久保存的对象。

Go
var bufPool = sync.Pool{
    New: func() any {
        // 缓存池为空时，自动调用 New 创建新对象
        return new(bytes.Buffer)
    },
}

func ProcessData(data []byte) {
    // 从池中获取对象
    buf := bufPool.Get().(*bytes.Buffer)
    buf.Reset() // 清理旧数据

    buf.Write(data)
    // ... 业务操作 ...

    // 用完放回池中
    bufPool.Put(buf)
}

6. sync.Cond（条件变量）

用于在特定条件满足时通知（挂起/唤醒）协程，通常与锁结合使用。适合实现“生产者-消费者”等待通知机制（比轮询高效）。

Go
var (
    mu    sync.Mutex
    cond  = sync.NewCond(&mu)
    ready bool
)

// 消费者协程
go func() {
    cond.L.Lock()
    for !ready {
        cond.Wait() // 自动释放锁并挂起，被唤醒时重新获取锁
    }
    fmt.Println("Data is ready, start processing...")
    cond.L.Unlock()
}()

// 生产者协程
time.Sleep(time.Second)
cond.L.Lock()
ready = true
cond.Signal() // 唤醒一个等待的协程 (或用 Broadcast 唤醒全部)
cond.L.Unlock()

使用避坑指南

结构体包含 sync 属性时切忌浅拷贝：
sync.Mutex、sync.WaitGroup、sync.Once 等包含不可复制的内部状态。如果把包含这些字段的结构体作为参数值传递，会导致锁状态失真。必须使用指针传递。

读写锁（RWMutex）防死锁：
不可在持有 RLock 的情况下再去尝试获取 Lock（锁升级），否则会导致死锁。

优先 Channel，慎用 Sync：
如果逻辑涉及协程间的数据流转与信号传递，优先选择 Channel；如果仅涉及保护临界区数据或简单计数，使用 sync 库性能更优。
