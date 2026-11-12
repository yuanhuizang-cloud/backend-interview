---
id: go-chan-panic-cases
type: 八股
difficulty: medium
tags: [channel, panic, 并发]
sources: [gemini]
date: 2026-11-12
---

## 题目
chan panic的情况有哪些

## 回答
在 Go 语言中，使用通道（chan）引发 panic 的情况非常明确且固定，主要分为 3 大类典型场景，以及 1 类相关的死锁场景（导致程序崩溃）。

理解并避开这些场景是写出高可用 Go 并发代码的基础。

一、 触发 Panic 的 3 大核心场景（面试必考）
1. 向已经关闭的 Channel 发送数据（Send on Closed Channel）

对一个已经调用过 close() 的通道再执行写入操作，会直接引发 panic。

错误示例：

Go
ch := make(chan int, 1)
close(ch)
ch <- 1 // panic: send on closed channel


规避原则： 牢记 Go 并发设计的第一准则——“只有发送方（Writer）才可以关闭通道，接收方（Reader）绝不要关闭通道”。

2. 重复关闭同一个 Channel（Close on Closed Channel）

对同一个通道调用两次 close()，第二次调用会引发 panic。

错误示例：

Go
ch := make(chan int)
close(ch)
close(ch) // panic: close of closed channel


规避原则： 确保 Channel 的关闭逻辑有且仅有一个确定的管理者，或者配合 sync.Once 来保证只关闭一次：

Go
var once sync.Once
once.Do(func() {
    close(ch)
})

3. 关闭一个未初始化（nil）的 Channel（Close on Nil Channel）

尝试对未初始化（未通过 make 创建，值为 nil）的通道调用 close()，会引发 panic。

错误示例：

Go
var ch chan int // ch 为 nil
close(ch)       // panic: close of nil channel

二、 对比记忆：nil 通道与 closed 通道的行为全景

为了防止混淆，面试或排查 Bug 时可以参照下表（只有上述 3 种情况会产生 panic）：

操作	未初始化 Channel (nil)	正常 Channel (active)	已关闭 Channel (closed)
读 (<-ch)	永久阻塞	阻塞（直到有数据）	立即返回零值（可以通过 v, ok := <-ch 中的 ok=false 判断已关闭）
写 (ch <- x)	永久阻塞	阻塞（直到被读取）	panic 💥
关闭 (close(ch))	panic 💥	正常关闭	panic 💥
三、 补充衍生：触发死锁崩溃（Fatal Error / Deadlock）

虽然永久阻塞在严格意义上不算 panic（无法被 recover() 捕获），但它会导致整个 Goroutine 泄露，如果在主 Goroutine 中发生，会导致 Go 运行时抛出致命错误并退出：

向 nil 通道读/写： 会导致当前 Goroutine 永久挂起（Block）。

所有 Goroutine 都在等待（fatal error: all goroutines are asleep - deadlock!）： 当主线程或所有协程都在等待一个永远不可能有人写入或读取的 channel 时，Go 运行时检测到全局死锁会直接强制终止程序。

四、 防御性编程最佳实践

单向生产者关闭模式： 始终由唯一的生产者（发送方）负责 close；如果是多生产者模式，不要在内部随意关闭，可以通过额外的退出信号通道（exitCh）或 context.Context 协调通知。

优雅判断通道状态： 接收方不要通过判断是否 panic 来确定 Channel 是否关闭，而应该使用 ok 语法：

Go
if val, ok := <-ch; !ok {
    // channel 已经关闭且缓冲区无数据
}
