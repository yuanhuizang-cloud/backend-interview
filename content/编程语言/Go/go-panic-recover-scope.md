---
id: go-panic-recover-scope
type: 八股
difficulty: medium
tags: [panic, recover]
sources: [gemini]
date: 2026-11-12
---

## 题目
go的所有panic 都能通过recover被recover住吗

## 回答
不是。 在 Go 语言中，并不是所有的 panic 或运行时致命错误都能被 recover 捕获。

Go 将运行时异常分为两大类：可恢复的普通 Panic（Recoverable Panic） 和 不可恢复的致命错误（Fatal Error / Crash）。

一、 哪些情况无法被 recover 捕获？（致命场景）
1. 跨 Goroutine 的 Panic

recover 只能捕获当前 Goroutine 内部抛出的 panic。如果你在子 Goroutine 中发生 panic，主 Goroutine 或其他协程里的 defer recover() 是完全无效的，整个进程会直接崩溃。

Go
func main() {
    // 这里的 defer recover 救不了子协程！
    defer func() {
        if r := recover(); r != nil {
            fmt.Println("尝试救场失败")
        }
    }()

    go func() {
        panic("子协程爆雷了") // 致命！程序直接 Crash
    }()

    time.Sleep(time.Second)
}

2. 并发读写非线程安全的 Map（Concurrent Map Writes）

当多个 Goroutine 同时对原生 map 进行读写时，Go 运行时检测到竞态冲突会直接调用 throw("concurrent map writes")。这属于 Fatal Error，绕过了普通 panic 的栈展开过程，无法被 recover 拦截。

Go
m := make(map[string]int)
go func() { for { m["a"] = 1 } }()
go func() { for { m["a"] = 2 } }() // 直接崩溃，无法 recover

3. 栈溢出（Stack Overflow）

当递归层级太深或循环调用消耗完系统允许的最大栈空间（通常 64 位系统上默认为 1GB）时，运行时抛出栈溢出错误，进程强制终止，recover 无法捕获。

4. 内存爆表 / Out of Memory (OOM)

当程序向系统申请内存失败，或者被操作系统 Cgroup（如 Docker/K8s 限额）杀死（OOM Kicker）时，属于操作系统层面或 runtime 底层的强制终止，无法在代码层 recover。

5. 死锁（Fatal Lockup / Deadlock）

当 Go 运行时检测到所有 Goroutine 都处于休眠/阻塞状态，且没有任何活动协程时，会触发全局死锁提示（fatal error: all goroutines are asleep - deadlock!），直接退出程序。

6. 错误的 recover 调用位置

recover() 必须直接在 defer 的匿名/具名函数第一层中被显式调用。如果被嵌套在子函数中，或者没有在 defer 块内，调用它只会返回 nil，导致 panic 捕获失败。

Go
// 错误示范 1：没有在 defer 里
recover() 

// 错误示范 2：在 defer 调用的子函数里（嵌套调用）
defer recoverHelper() 

func recoverHelper() {
    recover() // 无效！捕获不到
}

二、 哪些情况下可以被 recover 捕获？

除了上述极端场景外，常规的业务级 panic(...) 以及大部分常见运行时错误（Runtime Panic）均可被正常捕获：

显式调用 panic("error message")。

数组 / 切片下标越界（index out of range）。

空指针解引用（nil pointer dereference）。

除以零（integer divide by zero）。

类型断言失败（interface conversion: ...）。

向已关闭的 Channel 发送数据或关闭已关闭的 Channel。

三、 工程落地的防崩溃最佳实践

为了防止个别子协程崩溃导致整个微服务宕机，工程中常见的做法是：

子协程安全封装（Safe Goroutine）：
在所有 go func() 内部的第一行显式加上 defer recover() 兜底。

Go
func GoSafe(fn func()) {
    go func() {
        defer func() {
            if r := recover(); r != nil {
                // 记录日志、打印堆栈，防止主服务挂掉
                log.Printf("Goroutine Panic: %v\n%s", r, debug.Stack())
            }
        }()
        fn()
    }()
}


并发 Map 选用并发安全结构：
使用 sync.Mutex 加锁，或者直接用 sync.Map，绝不盲目并发读写原生 map。
