---
name: development-workflow
description: 遵循 massCode 仓库 workflow 时使用，尤其是 scoped lint/test，或变更后需要 code generation、locale sync 等 follow-up 命令。
---

# 开发 Workflow

## 概述

massCode 的 workflow 规则是变更质量的一部分。本地任务应使用精准命令；修改 source-of-truth 文件后必须执行规定的 follow-up。

## Lint 规则

- 仅对**受影响文件或目录**运行 lint。
- 本地任务**不要**全项目 lint。
- 示例：
  - `pnpm lint <path>`
  - `pnpm lint:fix <path>`

## 测试规则

- 仅对**受影响文件或目录**运行测试。
- 无明确必要不要跑全量 test suite。
- 示例：
  - `pnpm test <path>`
  - `pnpm test:watch <path>`

## 必须的 Follow-up 命令

- 改了 API DTO/routes → `pnpm api:generate`
- 改了 locale 文件 → `pnpm i18n:copy`

## 常见错误

- 小改动却跑全量 lint/test。
- 改了 source-of-truth 却忘记 generation/sync。
- “以防万一”跑宽命令，而非最小相关集合。
