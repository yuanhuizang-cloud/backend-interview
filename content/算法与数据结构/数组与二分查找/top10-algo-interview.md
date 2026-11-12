---
id: top10-algo-interview
type: 手撕代码
difficulty: hard
tags: [算法, LeetCode, 高频, LRU]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
大厂（百度、字节）当前高频热点算法面试题Top10，帮我罗列并给出代码

## 回答
小晶，按你的 Go 后端 / AI Backend 求职方向，我建议优先练下面这 10 道，代码全部用 Go。

先说明口径：截至 2026 年 10 月 15 日，公开面经不足以核实百度、字节统一的真实 Top10 排名。下面是结合近期面经、常见题型和练习价值整理的优先清单，序号代表建议练习顺序。

近期直接相关的信号：

百度 Agent Harness 面经出现 LRU 变种；字节后端面经出现 LRU + TTL，值得重点练。
+1
字节面经出现 最长无重复子串、小于 N 的最大数、二叉树右视图。
+1
公开整理的近期面经还涉及 K 个一组反转链表、第 K 大元素、二分边界、岛屿数量、乘积最大子数组；这些属于转述资料，可信度低于候选人直接记录。
+3
优先级	题目	核心方法	难度	最需要掌握的点
1	LRU 缓存，LC 146	哈希表 + 双向链表	中等	为什么 Get 也需要修改链表
2	无重复字符的最长子串，LC 3	滑动窗口	中等	左边界不能回退
3	K 个一组翻转链表，LC 25	链表指针操作	困难	分组检查、反转、重新连接
4	数组中的第 K 个最大元素，LC 215	小顶堆	中等	堆顶为什么就是第 K 大
5	二叉树的右视图，LC 199	BFS 层序遍历	中等	每层取最后一个节点
6	最长回文子串，LC 5	中心扩展	中等	奇数、偶数两种中心
7	在排序数组中查找元素的首尾位置，LC 34	两次二分	中等	下界、上界、区间约定
8	岛屿数量，LC 200	DFS / BFS	中等	连通分量与访问标记
9	乘积最大子数组，LC 152	动态规划	中等	同时保留最大值和最小值
10	用指定数字组成小于 N 的最大数	贪心 + 回溯	常见变种	严格小于、回退、位数不足

以下按 LeetCode 风格提供函数，省略 package main；需要导入的包会单独标明。

1．LRU 缓存

题意：实现固定容量缓存，`Get` 和 Put 平均时间复杂度均为 O(1)。容量不足时，淘汰最久没有使用的数据。

思路：哈希表负责快速定位；双向链表维护使用顺序。头部最新，尾部最旧。

Go
type Node struct {
    key, value int
    prev, next *Node
}

type LRUCache struct {
    capacity   int
    items      map[int]*Node
    head, tail *Node // 两个哨兵节点
}

func Constructor(capacity int) LRUCache {
    head, tail := &Node{}, &Node{}
    head.next = tail
    tail.prev = head

    return LRUCache{
        capacity: capacity,
        items:    make(map[int]*Node),
        head:     head,
        tail:     tail,
    }
}

func (c *LRUCache) remove(node *Node) {
    node.prev.next = node.next
    node.next.prev = node.prev
}

func (c *LRUCache) pushFront(node *Node) {
    node.prev = c.head
    node.next = c.head.next
    c.head.next.prev = node
    c.head.next = node
}

func (c *LRUCache) moveToFront(node *Node) {
    c.remove(node)
    c.pushFront(node)
}

func (c *LRUCache) Get(key int) int {
    node, ok := c.items[key]
    if !ok {
        return -1
    }

    c.moveToFront(node)
    return node.value
}

func (c *LRUCache) Put(key, value int) {
    if c.capacity <= 0 {
        return
    }

    if node, ok := c.items[key]; ok {
        node.value = value
        c.moveToFront(node)
        return
    }

    node := &Node{key: key, value: value}
    c.items[key] = node
    c.pushFront(node)

    if len(c.items) > c.capacity {
        oldest := c.tail.prev
        c.remove(oldest)
        delete(c.items, oldest.key)
    }
}
复杂度： Get / Put 平均 O(1)；空间 O(capacity)。
易错点： 更新已有 Key 不增加容量；淘汰时必须同时删除 map 和链表中的节点。
追问准备： 这个版本不支持并发。加锁时，Get 也会调整链表，不能只加读锁。TTL 与访问顺序也不一定一致，不能直接假设链表尾部就是最早过期的数据。

2．无重复字符的最长子串

题意：`"abcabcbb"返回3`，对应 "abc"。要求连续子串。

思路：记录每个字符上一次出现的位置；遇到窗口内重复字符时，把左边界跳到重复位置之后。

Go
func lengthOfLongestSubstring(s string) int {
    last := [256]int{} // 存储“上次出现下标 + 1”
    left, best := 0, 0

    for right := 0; right < len(s); right++ {
        ch := s[right]

        if last[ch] > left {
            left = last[ch]
        }

        size := right - left + 1
        if size > best {
            best = size
        }

        last[ch] = right + 1
    }

    return best
}
复杂度： 时间 O(n)，空间 O(1)，这里按字节处理。
易错点： "abba" 遍历到最后的 a 时，左边界不能从 2 回退到 1。
追问准备： 如果按中文等 Unicode 码点计数，改成 []rune 与 map[rune]int。

3．K 个一组翻转链表

题意：`1→2→3→4→5，k=2`，输出 2→1→4→3→5。剩余不足 K 个节点保持不变。

思路：先确定本组有 K 个节点，再反转这一组，最后连接前后两部分。

Go
type ListNode struct {
    Val  int
    Next *ListNode
}

func reverseKGroup(head *ListNode, k int) *ListNode {
    if head == nil || k <= 1 {
        return head
    }

    dummy := &ListNode{Next: head}
    groupPrev := dummy

    for {
        // 找到本组第 k 个节点。
        kth := groupPrev
        for i := 0; i < k && kth != nil; i++ {
            kth = kth.Next
        }

        if kth == nil {
            break
        }

        groupNext := kth.Next
        oldHead := groupPrev.Next

        // 反转 [oldHead, groupNext)。
        prev, curr := groupNext, oldHead
        for curr != groupNext {
            next := curr.Next
            curr.Next = prev
            prev = curr
            curr = next
        }

        // kth 变成组头，oldHead 变成组尾。
        groupPrev.Next = kth
        groupPrev = oldHead
    }

    return dummy.Next
}
复杂度： 时间 O(n)，额外空间 O(1)。
易错点： 必须先保存 groupNext；反转过程中要先保存 curr.Next。
练习建议： 如果这题写不出来，先把普通反转链表练到能不看答案写出来。

4．数组中的第 K 个最大元素

题意：`[3,2,1,5,6,4]，k=2`，返回 5。重复元素参与排名。

思路：维护容量为 K 的小顶堆，始终保存当前最大的 K 个元素，堆顶就是其中最小的，也就是第 K 大。

Go
import "container/heap"

type MinHeap []int

func (h MinHeap) Len() int           { return len(h) }
func (h MinHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h MinHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }

func (h *MinHeap) Push(x interface{}) {
    *h = append(*h, x.(int))
}

func (h *MinHeap) Pop() interface{} {
    old := *h
    n := len(old)
    x := old[n-1]
    *h = old[:n-1]
    return x
}

func findKthLargest(nums []int, k int) int {
    if k < 1 || k > len(nums) {
        panic("invalid k")
    }

    h := &MinHeap{}
    heap.Init(h)

    for _, x := range nums {
        if h.Len() < k {
            heap.Push(h, x)
        } else if x > (*h)[0] {
            (*h)[0] = x
            heap.Fix(h, 0)
        }
    }

    return (*h)[0]
}
复杂度： 时间 O(n log k)，空间 O(k)。
易错点： MinHeap.Pop() 删除的是切片末尾；由 heap.Pop() 负责先把堆顶交换到末尾。
追问准备： 数据流场景适合堆；一次性数组可以用快速选择，平均 O(n)，最坏 O(n²)。

5．二叉树的右视图

题意：从右侧观察二叉树，返回每一层最右边可见的节点。

思路：按层 BFS，每层从左到右处理，保存最后一个节点。

Go
type TreeNode struct {
    Val         int
    Left, Right *TreeNode
}

func rightSideView(root *TreeNode) []int {
    result := []int{}
    if root == nil {
        return result
    }

    level := []*TreeNode{root}

    for len(level) > 0 {
        result = append(result, level[len(level)-1].Val)

        next := make([]*TreeNode, 0)
        for _, node := range level {
            if node.Left != nil {
                next = append(next, node.Left)
            }
            if node.Right != nil {
                next = append(next, node.Right)
            }
        }

        level = next
    }

    return result
}
复杂度： 时间 O(n)，辅助空间 O(w)，`w` 为最大层宽，不计返回结果。
易错点： 右视图不是“沿着右孩子一直走”。右子树较浅时，左子树深处的节点也可能可见。
可迁移题型： 层序遍历、锯齿形遍历、每层最大值。

6．最长回文子串

题意：`"babad"可以返回"bab"或"aba"；"cbbd"返回"bb"`。

字节后端直接面经记录过这道题，中心扩展后还被追问了其他解法。

思路：枚举回文中心，向两侧扩展。奇数长度中心是一个字符，偶数长度中心是两个字符之间。

Go
func longestPalindrome(s string) string {
    if len(s) < 2 {
        return s
    }

    start, bestLen := 0, 1

    expand := func(left, right int) {
        for left >= 0 && right < len(s) &&
            s[left] == s[right] {
            left--
            right++
        }

        // 退出循环时，合法区间是 [left+1, right)。
        size := right - left - 1
        if size > bestLen {
            start = left + 1
            bestLen = size
        }
    }

    for i := 0; i < len(s); i++ {
        expand(i, i)   // 奇数长度
        expand(i, i+1) // 偶数长度
    }

    return s[start : start+bestLen]
}
复杂度： 时间 O(n²)，额外空间 O(1)。
易错点： 漏掉偶数回文；扩展退出后的边界多减或少减一次。
适用范围： 代码按字节比较，适合原题的英文字母、数字输入。

7．在排序数组中查找元素的首尾位置

题意：`[5,7,7,8,8,10]，target=8`，返回 [3,4]；不存在返回 [-1,-1]。

思路：分别寻找第一个 >= target 的位置和第一个 > target 的位置。

Go
func searchRange(nums []int, target int) []int {
    // 第一个 >= target 的位置。
    left, right := 0, len(nums)
    for left < right {
        mid := left + (right-left)/2
        if nums[mid] < target {
            left = mid + 1
        } else {
            right = mid
        }
    }

    first := left
    if first == len(nums) || nums[first] != target {
        return []int{-1, -1}
    }

    // 第一个 > target 的位置。
    left, right = first, len(nums)
    for left < right {
        mid := left + (right-left)/2
        if nums[mid] <= target {
            left = mid + 1
        } else {
            right = mid
        }
    }

    return []int{first, left - 1}
}
复杂度： 时间 O(log n)，空间 O(1)。
易错点： 这里始终使用左闭右开区间 [left, right)，不要混用 right = mid - 1。
百度相关变种： 统计有序数组中某个数出现几次，直接用 末位置 - 首位置 + 1，不存在则为 0。

8．岛屿数量

题意：二维网格中，`'1' 是陆地，'0'` 是水；上下左右连接的陆地属于同一座岛。

思路：每发现一块尚未访问的陆地，岛屿数加一，再用 DFS 把整座岛标记掉。

Go
func numIslands(grid [][]byte) int {
    if len(grid) == 0 || len(grid[0]) == 0 {
        return 0
    }

    rows, cols := len(grid), len(grid[0])
    count := 0

    var dfs func(int, int)
    dfs = func(r, c int) {
        if r < 0 || r >= rows || c < 0 || c >= cols ||
            grid[r][c] != '1' {
            return
        }

        // 先标记，再访问邻居，避免重复进入。
        grid[r][c] = '0'

        dfs(r-1, c)
        dfs(r+1, c)
        dfs(r, c-1)
        dfs(r, c+1)
    }

    for r := 0; r < rows; r++ {
        for c := 0; c < cols; c++ {
            if grid[r][c] == '1' {
                count++
                dfs(r, c)
            }
        }
    }

    return count
}
复杂度： 时间 O(mn)；递归栈最坏空间 O(mn)。
易错点： 本实现会修改输入，且假设网格为矩形。
追问准备： 不允许修改输入则增加 visited；担心递归过深则使用显式栈或 BFS。

9．乘积最大子数组

题意：`[2,3,-2,4]` 返回 6，对应连续子数组 [2,3]。

思路：负数会把最小值变成最大值，因此同时维护“以当前位置结尾的最大乘积”和“最小乘积”。

Go
func maxProduct(nums []int) int {
    if len(nums) == 0 {
        return 0
    }

    maxEnd, minEnd := nums[0], nums[0]
    answer := nums[0]

    for i := 1; i < len(nums); i++ {
        x := nums[i]

        // 都要使用上一轮的 maxEnd、minEnd。
        a := maxEnd * x
        b := minEnd * x

        maxEnd, minEnd = x, x

        if a > maxEnd {
            maxEnd = a
        }
        if b > maxEnd {
            maxEnd = b
        }

        if a < minEnd {
            minEnd = a
        }
        if b < minEnd {
            minEnd = b
        }

        if maxEnd > answer {
            answer = maxEnd
        }
    }

    return answer
}
复杂度： 时间 O(n)，空间 O(1)。
易错点： 不能更新 maxEnd 后，再用这个新值计算 minEnd。
关键用例： [-2,3,-4] → 24；`[-2,0,-1] → 0`。
数值约定： 假设计算过程中乘积能用 int 表示；实际面试应确认范围。

10．用指定数字组成小于 N 的最大数

这类题在字节直接面经，以及同时包含百度、字节经历的面经里出现过。不同版本可能要求“小于”或“不超过”，动手前必须确认。
+1

这里约定：

给定数字集合 digits，数字可以重复使用。
返回严格小于 n 的最大正整数。
不允许前导零；不存在返回 -1。

例如：

纯文本
digits = [1, 3, 5], n = 345 → 335
digits = [1, 3, 5], n = 333 → 331
digits = [5, 7],    n = 500 → 77

思路：先把严格小于 N 转成不超过 N−1；从高位开始尝试最大的合法数字。如果相等前缀走不通，就回退选择更小的数字。

Go
import "strconv"

func maxNumberLessThanN(digits []int, n int) int {
    if n <= 1 {
        return -1
    }

    allowed := [10]bool{}
    maxDigit := -1

    for _, d := range digits {
        if d < 0 || d > 9 {
            continue
        }

        allowed[d] = true
        if d > maxDigit {
            maxDigit = d
        }
    }

    // 没有非零数字，就无法组成正整数。
    if maxDigit <= 0 {
        return -1
    }

    bound := strconv.Itoa(n - 1)
    path := make([]byte, len(bound))

    // tight：前面是否仍与 bound 完全相等。
    var dfs func(pos int, tight bool) bool
    dfs = func(pos int, tight bool) bool {
        if pos == len(bound) {
            return true
        }

        limit := 9
        if tight {
            limit = int(bound[pos] - '0')
        }

        for d := limit; d >= 0; d-- {
            if !allowed[d] || (pos == 0 && d == 0) {
                continue
            }

            path[pos] = byte('0' + d)
            nextTight := tight && d == int(bound[pos]-'0')

            if dfs(pos+1, nextTight) {
                return true
            }
        }

        return false
    }

    if dfs(0, true) {
        answer, _ := strconv.Atoi(string(path))
        return answer
    }

    // 同位数无解：少一位，每一位都放最大数字。
    if len(bound) == 1 {
        return -1
    }

    answer := 0
    for i := 0; i < len(bound)-1; i++ {
        answer = answer*10 + maxDigit
    }

    return answer
}
复杂度： 设 N 有 L 位，时间 O(10L)，空间 O(L)。只有保持相等的前缀可能继续失败；一旦选小，后续即可填满。
易错点： 把 < N 写成 <= N；忘记禁止前导零；相同位数无解时没有考虑减少一位。
规则变化： 如果每个数字只能使用一次，这份代码不适用，需要增加使用次数约束。

对你来说，先验收 第 1～5 题：每题能在 20 分钟内独立写出、说明复杂度，并主动补三个边界用例。其中 LRU 再多练一步：解释如何加并发控制和 TTL，这部分最容易与你已有的后端经验连起来。

10月15日周四 15:51
