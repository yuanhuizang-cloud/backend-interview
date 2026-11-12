---
id: namespace-cgroup
type: 概念题
difficulty: medium
tags: [namespace, cgroup, 隔离]
sources: [gemini]
date: 2026-11-12
---

## 题目
有没有开源库 可以直接快速创建沙箱 另外namespace和cgroup分别控制什么

## 回答
可以直接使用现成的开源库来快速创建沙箱，同时利用 Linux 内核的 Namespace 和 Cgroup（Control Groups）机制控制底层资源。

一、 开源沙箱库推荐
1. E2B (e2b-dev/E2B)

特点：最火的 AI 代码执行沙箱库，底层基于 Firecracker MicroVM（微型虚拟机），启动极快且实现硬件级安全隔离。

使用体验：极简 Python / TypeScript SDK，非常适合执行 AI Agent 生成的代码。

Python
# pip install e2b-code-interpreter
from e2b_code_interpreter import Sandbox

# 快速创建一个轻量级隔离沙箱
with Sandbox() as sandbox:
    execution = sandbox.run_code("x = 10; y = 20; x + y")
    print(execution.text) # 输出 30

2. OpenSandbox (opensandbox-group/OpenSandbox)

特点：国内团队开源的通用 Agent 沙箱引擎。支持绑定 Docker、Kubernetes，并且兼容 gVisor 和 Kata Containers 作为隔离底座。

使用体验：不仅能跑 Python 代码，还内置了浏览器自动化、VNC 桌面、桌面工具等环境。

3. SandboxAI (substratusai/sandboxai)

特点：基于本地 Docker 的轻量化 Agent 沙箱。只需在本地起一个容器服务，就可以用 SDK 一行代码拉起隔离环境。

二、 Namespace 与 Cgroup 分别控制什么？

在传统容器/沙箱（如 Docker/LXC）中，Namespace 和 Cgroup 是 Linux Container 的两大基石：

Namespace 解决的是“能不能看到”的问题（视图隔离/视界控制）

Cgroup 解决的是“能不能用完”的问题（资源配额/用量控制）

1. Namespace（命名空间）：控制“视界与隔离”

Namespace 的作用是将全局的系统资源切分成独立的虚拟视图。运行在某个 Namespace 里的进程，看不到也无法干涉其他 Namespace 里的进程和资源。

主要包含以下 6+1 种核心隔离：

Namespace 类型	隔离的系统资源	实际控制的效果（在沙箱内看到的现象）
PID (Process ID)	进程编号	容器内部的 1 号进程是沙箱主进程，看不到宿主机的其他进程，也无法杀死宿主机进程。
NET (Networking)	网络设备、IP、端口、路由表	拥有独立的虚拟网卡（如 eth0）和回环口，无法侵占宿主机的网络端口。
MNT (Mount)	文件系统挂载点	结合 chroot / pivot_root，容器拥有独立的文件系统目录树，看不到宿主机的硬盘文件。
UTS (UNIX Timesharing)	主机名（Hostname）和域名	沙箱可以随意改自己的 Hostname，不影响宿主机。
IPC (Inter-Process Communication)	进程间通信（共享内存、信号量等）	无法通过共享内存与宿主机上的其他进程秘密通信。
USER (User ID)	用户和组 ID	沙箱内部的 root 用户映射到宿主机只是一个没有任何特权的普通用户，防止提权。
CGROUP	Cgroup 视图	隔离 /proc/cgroup 目录，限制进程查看自己的资源限制信息。
2. Cgroup（Control Groups 控制组）：控制“资源使用上限”

即使通过 Namespace 把进程关在小黑屋里，如果它运行了一个死循环 while(true) 或无限申请内存 malloc()，依然会导致整个宿主机 CPU 飙满或宕机（OOM）。

Cgroup 的作用就是给 Namespace 划定资源使用的物理上限。

主要控制的资源维度：

Cgroup 子系统	控制的具体资源	实际配置与控制效果
cpu	CPU 配额与限制	限制 CPU 使用率上限。例如：给沙箱限制 1.5核，即使跑死循环最多也只能占用 150% CPU。
memory	内存上限与 OOM 策略	限制可用物理内存与 Swap。例如：给沙箱设定 512MB 限制，一旦超过就会直接触发 OOM 杀掉该沙箱进程，保护宿主机不崩溃。
blkio	块设备 I/O 读写速率	限制磁盘读写 TPS 和 BPS。防止恶意代码频繁读写磁盘导致宿主机磁盘 IOPS 被打满。
net_cls / net_prio	网络流量控制	设置网络数据包的优先级或结合 tc 命令限制沙箱的出入口带宽速率（如限速 10Mbps）。
pids	最大进程数	限制沙箱内部允许创建的最大进程/协程数量。防止“Fork 炸弹”（即用无限 fork() 把系统进程号耗尽）。
总结口诀

Namespace（隔离）：“你看不到我，我也看不到你，大家各有各的界域。”

Cgroup（限额）：“不管你怎么折腾，最多只能用 1 核 CPU 和 512MB 内存，超了直接抹杀。”
