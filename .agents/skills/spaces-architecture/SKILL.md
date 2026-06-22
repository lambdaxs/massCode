---
name: spaces-architecture
description: 处理 massCode 的 code、notes、math、tools 等 space，尤其是状态、行为、同步或 spaces IPC channel 时使用。
---

# Spaces 架构

## 概述

massCode 用 **Spaces** 划分功能域。不仅是 UI tab：每个 space 有独立状态、更新规则及与 vault 数据的同步方式。

## Space 模型

- `code` — snippets、folders、tags
- `notes` — notes、folders、tags、markdown 流程
- `math` — 计算 sheet、math notebook 状态
- `tools` — 开发者工具

主要定义在 `src/renderer/spaceDefinitions.ts`。

## Space 状态存储

- 各 space 状态在 vault 内 `__spaces__/{spaceId}/.state.yaml`。
- Runtime helpers：
  - `src/main/storage/providers/markdown/runtime/spaces.ts`
  - `src/main/storage/providers/markdown/runtime/spaceState.ts`
- `__spaces__/` 是 vault 中存放 space 状态的系统目录。

## 持久化规则

- Space 状态写入使用与 `state.json` 相同的 debounce/flush 基础设施。
- 不要破坏与 `pendingStateWriteByPath`、flush-on-exit 的兼容。
- 若改写入方式，须考虑应用退出前未手动 flush 的场景。

## IPC 规则

- Space 相关 IPC 在 `src/main/ipc/handlers/spaces.ts`。
- 当前 math handlers：
  - `spaces:math:read`
  - `spaces:math:write`
- 新增 `spaces:*` flow 须走统一 space 状态模型，不可绕过。

## Space 感知同步

- `system:storage-synced` 通过 `getActiveSpaceId()` 刷新当前 space。
- 预期行为：
  - `code` → refresh folders + snippets
  - `notes` → refresh notes + note folders
  - `math` → `useMathNotebook()` 的 `reloadFromDisk()`
  - `tools` → no-op
- 已写入 vault 的变更应调用 `markPersistedStorageMutation()`，避免 sync loop。

## 常见错误

- 把 space 当纯 UI 概念，忽略独立状态与同步规则。
- 绕过 markdown runtime helpers 写 space 状态。
- mutation 不加 `markPersistedStorageMutation()`。
- space 状态、helpers、sync 行为不一致。
