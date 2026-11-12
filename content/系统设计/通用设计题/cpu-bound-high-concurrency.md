---
id: cpu-bound-high-concurrency
type: 场景题
difficulty: hard
tags: [高并发, 计算密集, 性能]
sources: [gemini]
date: 2026-11-12
---

## 题目
计算密集型应用，如何保证性能 高并发场景的工程实践和落地经验 以及面试如何回答类似的问题

## 回答
Top-K 问题是字节、腾讯、百度等大厂算法面试中的最高频高胜率考题。面试官考察 Top-K 时，绝不仅仅看你能不能写出代码，更看重你对堆（Heap）的时间/空间复杂度分析（相比全局排序 
𝑂
(
𝑁
log
⁡
𝑁
)
O(NlogN)，堆解法可以优化至 
𝑂
(
𝑁
log
⁡
𝐾
)
O(NlogK)，空间 
𝑂
(
𝐾
)
O(K)）。

针对 Top-K 场景，核心规则是：

求最大的前 K 个元素（Top K Max）： 维护一个容量为 K 的 小顶堆（Min-Heap）。

求最小的前 K 个元素（Top K Min）： 维护一个容量为 K 的 大顶堆（Max-Heap）。

下面为你精选 2 道最核心的热点算法题，分别提供 Go（实现 container/heap 标准接口）和 Python（使用标准库 heapq）的完整实现。

热点题一：LeetCode 347. 前 K 个高频元素 (Top K Frequent Elements)
1. 解题思路

哈希表统计频次：先遍历一次数组，用 Map/Dict 记录每个元素出现的频率。

容量为 K 的小顶堆：遍历频次哈希表，将 (元素, 频次) 压入小顶堆。如果堆的大小超过 K，弹出堆顶（即当前频次最低的元素）。遍历结束后，堆中留下的就是频次最高的前 K 个元素。

2. Go 语言实现

Go 的 container/heap 需要自定义结构体并实现 heap.Interface 的 5 个方法（Len, Less, Swap, Push, Pop）。

Go
package main

import (
	"container/heap"
)

// 1. 定义元素及频次结构体
type Pair struct {
	num   int
	count int
}

// 2. 实现小顶堆（按 count 升序）
type MinHeap []Pair

func (h MinHeap) Len() int           { return len(h) }
func (h MinHeap) Less(i, j int) bool { return h[i].count < h[j].count } // 小顶堆：频次小的在前
func (h MinHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }

func (h *MinHeap) Push(x interface{}) {
	*h = append(*h, x.(Pair))
}

func (h *MinHeap) Pop() interface{} {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}

func topKFrequent(nums []int, k int) []int {
	// A. 统计频次
	freqMap := make(map[int]int)
	for _, num := range nums {
		freqMap[num]++
	}

	// B. 维护容量为 K 的小顶堆
	h := &MinHeap{}
	heap.Init(h)

	for num, count := range freqMap {
		heap.Push(h, Pair{num: num, count: count})
		if h.Len() > k {
			heap.Pop(h) // 弹出频次最小的
		}
	}

	// C. 导出结果
	res := make([]int, k)
	for i := k - 1; i >= 0; i-- {
		res[i] = heap.Pop(h).(Pair).num
	}
	return res
}

3. Python 语言实现

Python 标准库 heapq 默认是小顶堆。我们可以直接传入元组 (count, num)，heapq 会默认根据元组第一个元素（即频次 count）进行比较。

Python
import heapq
from collections import Counter

def topKFrequent(nums: list[int], k: int) -> list[int]:
    # A. 统计频次
    freq_map = Counter(nums)
    
    # B. 维护容量为 K 的小顶堆
    min_heap = []
    for num, count in freq_map.items():
        heapq.heappush(min_heap, (count, num))
        if len(min_heap) > k:
            heapq.heappop(min_heap)  # 弹出当前堆中频次最低的
            
    # C. 提取结果
    return [num for count, num in min_heap]

热点题二：LeetCode 215. 数组中的第 K 个最大元素 (Kth Largest Element)
1. 解题思路

这是 Top-K 最基础也最常考的形式。“第 K 个最大元素”等价于前 K 个最大元素中最小的那一个。

维护一个容量为 K 的小顶堆。

遍历数组，保证堆大小为 K，遍历结束后，堆顶元素（heap[0]）即为第 K 大元素。

复杂度分析：时间复杂度 
𝑂
(
𝑁
log
⁡
𝐾
)
O(NlogK)，空间复杂度 
𝑂
(
𝐾
)
O(K)。

2. Go 语言实现

为展现极简写法，这里定义基本整型切片的小顶堆：

Go
package main

import (
	"container/heap"
)

type IntMinHeap []int

func (h IntMinHeap) Len() int           { return len(h) }
func (h IntMinHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h IntMinHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }

func (h *IntMinHeap) Push(x interface{}) {
	*h = append(*h, x.(int))
}

func (h *IntMinHeap) Pop() interface{} {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[0 : n-1]
	return x
}

func findKthLargest(nums []int, k int) int {
	h := &IntMinHeap{}
	heap.Init(h)

	for _, num := range nums {
		heap.Push(h, num)
		if h.Len() > k {
			heap.Pop(h)
		}
	}

	return (*h)[0] // 堆顶即为第 K 大元素
}

3. Python 语言实现
Python
import heapq

def findKthLargest(nums: list[int], k: int) -> int:
    min_heap = []
    for num in nums:
        heapq.heappush(min_heap, num)
        if len(min_heap) > k:
            heapq.heappop(min_heap)
            
    return min_heap[0]  # 堆顶即为第 K 大元素

面试核心得分要点避坑指南

为什么用容量为 
𝐾
K 的小顶堆，而不是建 
𝑁
N 个元素的大顶堆？

如果建 
𝑁
N 个元素的大顶堆再 Pop 
𝐾
K 次，时间复杂度是 
𝑂
(
𝑁
+
𝐾
log
⁡
𝑁
)
O(N+KlogN)，空间是 
𝑂
(
𝑁
)
O(N)。

如果维护容量为 
𝐾
K 的小顶堆，时间复杂度是 
𝑂
(
𝑁
log
⁡
𝐾
)
O(NlogK)，空间是 
𝑂
(
𝐾
)
O(K)。在海量数据（如 
𝑁
=
10
9
,
𝐾
=
100
N=10
9
,K=100）的场景下，容量 
𝐾
K 的小顶堆占用的内存微乎其微，完全可以加载在内存中处理海量数据流。

Go 语言实现细节：

注意 Pop() 方法的实现：heap.Pop() 会先将堆顶和最后一个元素交换，然后调用你自定义的 Pop() 剪掉切片最后一个元素。千万不要在自定义的 Pop() 里直接返回第 0 个元素！
