---
name: electron-api-and-ipc
description: 修改 massCode API routes、DTO、IPC handlers、Electron 桥接，或 renderer 与 main 通信及存储访问边界时使用。
---

# Electron API 与 IPC

## 概述

massCode 的后端能力均在 main process。Renderer 仅通过 Elysia API 或 IPC channel 访问数据与系统操作。

## Renderer 访问规则

- 数据：`import { api } from '~/renderer/services/api'`。
- 系统操作：`ipc.invoke('channel:action', payload)`。
- Electron API 在 renderer 仅通过 `src/renderer/electron.ts`。
- **不要**在 renderer 直接 import storage internals 或 backend 模块。

## 新增 API Endpoint

1. 在 `src/main/api/dto/` 创建 DTO；
2. 在 `src/main/api/routes/` 添加 route；
3. 运行 `pnpm api:generate` 更新客户端。

不要使 API client 与 route/DTO 变更不同步。

## IPC 约定

- 文件系统与系统操作用 `ipc.invoke(...)`。
- Channel 归属族：
  - `fs:*`
  - `system:*`
  - `db:*` — legacy 或 migration，非新功能主路径
  - `main-menu:*`
  - `prettier:*`
  - `spaces:*`
  - `theme:*`

## 良好边界

- Renderer 表达 intent 与 payload。
- Main/API 处理应用数据、文件系统、系统 API。
- 响应以 DTO 或 IPC result 回到 renderer，而非共享可变 backend module。

## 常见错误

- 为“方便”在 renderer 直接 import backend 模块。
- 改 DTO/route 却不跑 `pnpm api:generate`。
- 在 renderer 做本应在 IPC handler 里的 system/file 行为。
- 本可走 API/IPC 却新增 `db:*` flow。
- 创建不符合现有 channel 族的 ad-hoc channel。
