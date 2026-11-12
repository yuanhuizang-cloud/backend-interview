---
id: go-slice-intersection
type: 手撕代码
difficulty: easy
tags: [切片, map, 交集]
sources: [gemini]
date: 2026-11-12
---

## 题目
go slice切片取交集

## 回答
Go 语言原生没有直接提供切片求交集的内置函数。在实际开发中，最通用且高效的方法是利用 map（哈希表） 来存储其中一个切片的元素，再遍历另一个切片进行匹配。

针对不同场景，实现方式如下：

1. 通用高效实现（支持任意可比较类型，使用泛型）

利用 Go 1.18+ 的 generic 泛型和空结构体 struct{}（零内存开销）实现：

Go
package main

import "fmt"

// Intersection 返回两个切片的交集（去重）
func Intersection[T comparable](slice1, slice2 []T) []T {
	m := make(map[T]struct{})
	for _, v := range slice1 {
		m[v] = struct{}{}
	}

	var result []T
	for _, v := range slice2 {
		if _, exists := m[v]; exists {
			result = append(result, v)
			delete(m, v) // 防止 slice2 中有重复元素导致结果重复
		}
	}
	return result
}

func main() {
	a := []int{1, 2, 3, 4, 5, 2}
	b := []int{2, 4, 6, 8, 2}

	fmt.Println(Intersection(a, b)) // 输出: [2 4]
}


2. 已排序切片实现（双指针法，无额外内存开销）

如果输入的两个切片已经排好序，可以使用双指针遍历，时间复杂度为 
𝑂
(
𝑛
+
𝑚
)
O(n+m)，空间复杂度为 
𝑂
(
1
)
O(1)：

Go
package main

import "fmt"

func IntersectionSorted(a, b []int) []int {
	var result []int
	i, j := 0, 0

	for i < len(a) && j < len(b) {
		if a[i] < b[j] {
			i++
		} else if a[i] > b[j] {
			j++
		} else {
			// 去重逻辑：如果结果集为空或最后一个元素不等于当前值，则放入
			if len(result) == 0 || result[len(result)-1] != a[i] {
				result = append(result, a[i])
			}
			i++
			j++
		}
	}
	return result
}

func main() {
	a := []int{1, 2, 2, 4, 5}
	b := []int{2, 2, 4, 6, 8}

	fmt.Println(IntersectionSorted(a, b)) // 输出: [2 4]
}


关键注意点

时空复杂度：Map 哈希法的时间复杂度为 
𝑂
(
𝑛
+
𝑚
)
O(n+m)，需要额外 
𝑂
(
𝑛
)
O(n) 的空间存 Map；双指针法时间复杂度为 
𝑂
(
𝑛
+
𝑚
)
O(n+m)，不需要额外的 Map 空间。

去重控制：在处理包含重复元素的切片时，若需保留唯一交集，需在匹配后将 Map 中的 Key 删除，或在结果集追加前检查是否重复。
