---
name: api-and-typing
description: 定义或审查 massCode renderer 中来自 generated API client 或 DTO 的类型时使用，尤其是决定复用现有 API shape、派生更窄的本地类型，还是引入仅 UI 使用的 model。
---

# API 与类型

## 概述

massCode 的 API 类型以 **generated-first** 为准。若数据来自 `~/renderer/services/api/generated` 或对应 `src/main/api/dto` 中的 DTO，优先使用已有类型与 utility typing，不要在组件旁随意新建 interface。

## 核心规则

- 不要手写 API response 类型的重复定义。
- 先在 `~/renderer/services/api/generated` 中查找类型。
- 若无直接 export，用 `Pick`、`Omit`、indexed access、`Parameters`、`ReturnType`、`Awaited`、`NonNullable` 推导所需 shape。
- 本地类型仅适用于：UI-only model、form model、derived display model，或在 data narrowing 之后的 narrow type。

## 适合使用本地类型的场景

- nullable API data 已在某处清理后的窄 renderer shape。
- dashboard card、graph node、readonly row、editor-side helper 等 view-model（且不等于 transport shape）。
- 通过 `Parameters` / `ReturnType` 从已有 composable 或 API method 推导的参数类型。

## 不适合使用本地类型的场景

- 完整复制 `SnippetsResponse`、`NotesDashboardResponse`、`TagsResponse` 等 generated types。
- 为“方便”新建 interface，而本可从 existing response type 取某一分支。
- 在 renderer 文件中复制 DTO shape，而其实已可 import。

## 常见错误

- 先写本地 interface，再去找 generated type。
- 混用 transport shape 与 UI view-model，且没有明确的 adapter 步骤。
- 把原始 nullable API 字段深传到 UI，而不是在一个 normalization 点处理。
