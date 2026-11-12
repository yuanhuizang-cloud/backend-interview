---
id: docker-compose-interpolation
type: 场景题
difficulty: easy
tags: [Docker Compose, 环境变量]
sources: [gemini]
date: 2026-11-12
---

## 题目
docker compose up -d
invalid interpolation format for services.agent_backend.environment.DIFY_AGENT_REDIS_URL: "redis://:${REDIS_PASSWORD:-difyai123456". You may need to escape any $ with another $

## 回答
This error occurs because of a missing closing curly brace } in the environment variable syntax within your docker-compose.yml (or .env) file.

Cause

The string missing the brace is:

Plaintext
redis://:${REDIS_PASSWORD:-difyai123456


Docker Compose expects standard bash parameter expansion syntax ${VARIABLE:-default_value}. Missing the closing } breaks parsing.

Fix

Open your docker-compose.yml file.

Locate the agent_backend service under services:.

Find the DIFY_AGENT_REDIS_URL line and add the missing closing brace }:

YAML
# Before (incorrect):
DIFY_AGENT_REDIS_URL: "redis://:${REDIS_PASSWORD:-difyai123456"

# After (fixed):
DIFY_AGENT_REDIS_URL: "redis://:${REDIS_PASSWORD:-difyai123456}"


Save the file and rerun:

Bash
docker compose up -d
