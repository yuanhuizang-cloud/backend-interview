---
id: go-pprof-memory
type: 场景题
difficulty: medium
tags: [pprof, 内存, 性能]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
(dlv) print runtime.MemStats Command failed: could not find symbol value for runtime

## 回答
明白了，你遇到的情况是 core 文件里 dlv 无法直接访问 runtime 包的符号。这是因为：

Go 的二进制默认 不包含完整符号表（尤其是 release build，常用 -ldflags="-s -w"），所以 core dump 中很多 runtime/标准库符号不可用。
dlv 在 core 文件模式下 只能访问可执行文件中实际存在的符号，而 runtime 的全局变量（如 runtime.MemStats）在 release 编译中通常被优化掉，导致无法访问。
解决思路
方法 1：在可执行文件中启用调试信息

重新编译服务，添加调试信息：

Bash
go build -gcflags="all=-N -l" -o fusion-server-debug ./cmd/main
-N 禁用优化
-l 禁用内联
这样生成的二进制包含完整符号，core 文件就能访问 runtime 等全局变量

然后生成 core dump，再用 dlv core ./fusion-server-debug ./core.xxx 就可以：

dlv
(dlv) print runtime.MemStats
方法 2：使用 live attach

如果服务仍在运行，可以直接 attach：

Bash
dlv attach <pid>
这样可以访问运行时的 runtime 符号
可直接 print runtime.MemStats 或者查看 goroutine、heap 分配
方法 3：使用 pprof

即使 core 文件里无法访问 runtime，你仍可以在运行的服务中启用 pprof：

Go
import _ "net/http/pprof"
go func() {
    log.Println(http.ListenAndServe("localhost:6060", nil))
}()

然后用 go tool pprof 获取堆信息：

Bash
go tool pprof http://localhost:6060/debug/pprof/heap
可以分析对象大小、分配热点
不依赖 dlv 的 runtime 符号

💡 总结

在 core 文件模式下，`runtime` 符号通常不可用 → 所以无法 print runtime.MemStats
解决办法：带调试信息重编译 + core dump，或 attach 到 live 进程 + pprof

我可以帮你写一个 针对 OOM 的 dlv 分析流程脚本，兼容 core dump 和 live attach，同时输出 goroutine 和大对象内存信息，这样你排查更快。

你希望我直接帮你写吗？
