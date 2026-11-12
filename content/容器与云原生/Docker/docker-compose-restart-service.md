---
id: docker-compose-restart-service
type: 场景题
difficulty: easy
tags: [Docker Compose, 重启]
sources: [gemini]
date: 2026-11-12
---

## 题目
docker compose 如何单独重启某一个服务

## 回答
在 Docker Compose 中，你可以直接在命令末尾指定服务名称（即 docker-compose.yml 或 compose.yaml 中定义的 services 下的服务名）来单独重启该服务。

常用重启命令

直接重启服务（最常用）：

Bash
docker compose restart <service_name>


示例：如果服务名为 nginx，执行 docker compose restart nginx 即可单独重启该容器。

验证方式：运行 docker compose ps 查看该服务的 STATUS 显示为 Up (about a minute) 或更新的时间。

重新构建并重启服务（修改了 Dockerfile 或配置后）：
如果你修改了该服务的代码、Dockerfile 或环境变量，仅 restart 不会应用新的构建：

Bash
docker compose up -d --build <service_name>


验证方式：查看终端输出，确认仅针对该服务执行了 Recreating 或 Starting。

彻底销毁并重新创建单服务：
强制停止、删除并重新拉起该服务容器：

Bash
docker compose stop <service_name>
docker compose rm -f <service_name>
docker compose up -d <service_name>


提示：旧版 Docker Compose 语法使用的是带连字符的 docker-compose（如 docker-compose restart <service_name>），命令参数与新版完全一致。
