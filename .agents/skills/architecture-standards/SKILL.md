---
name: architecture-standards
description: 在 massCode 中需要仓库级架构规则、命名约定、拆分边界，或选择下一个 skill 时使用。
---

# 架构规范

## 概述

项目基本原则：**YAGNI，简单优先**。不要为假想场景过度设计，不要在没有重复需求时堆抽象，不要模糊 renderer、API 与 main 的边界。

## 核心规则

- 遵守分层：
  - **Renderer**：仅 UI、composables、调用 `api.*` 与 `ipc.invoke(...)`。
  - **API**：Elysia routes、DTO、orchestration、访问服务与应用数据。
  - **Main**：系统集成、IPC handlers、lifecycle、应用数据层。
- 默认数据流：Renderer → API / IPC → service / data layer → response。
- Vue 组件命名：`PascalCase`。
- TypeScript 文件命名：`camelCase`。
- Composables 以 `use` 为前缀，文件名与导出函数名一致。

## YAGNI 护栏

过度设计的信号：

- 为不存在的场景写防御逻辑；
- factory/wrapper 只用一次且不隐藏状态；
- 为抽象而抽象，没有重复痛点；
- 常量、模式、配置凭空发明，而非来自真实需求。

## 组件拆分

- 组件超过约 **300** 行，或承担 **3+** 个无关职责时，应拆分。
- 拆分顺序：
  1. 抽出常量与静态数据；
  2. 纯函数抽到 utils（仅当真正复用时）；
  3. 状态与副作用移到 composable；
  4. 模板拆成局部子组件。
- `<template>` 中逻辑不应复杂于三元表达式。

## Feature 子目录

- 某域长成独立 subsystem 时，将局部组件、helpers、tests、fixtures  grouped 到子目录。
- 子目录内文件名不要重复父级完整前缀。
- 局部文件靠近 feature；跨域共享代码放在更高层。

## 何时加载其他 Skills

- Vue renderer、auto-imports、composables、共享状态：`vue-renderer-standards`
- 视觉基础、typography、renderer 样式决策：`ui-foundations`
- `Ui*`、Shadcn、`cn`、`cva`、通知：`ui-primitives`
- API routes、DTO、IPC、Electron 边界：`electron-api-and-ipc`
- generated API types、utility typing、本地 view-model：`api-and-typing`
- `code` / `notes` / `math` / `tools`、space 状态与同步：`spaces-architecture`
- i18n、locale keys、`i18n.t(...)`：`i18n`
- docs 站点、sidebar、截图、README 功能提及：`documentation-workflow`
- scoped lint/test 与 follow-up 命令：`development-workflow`

## 常见错误

- 把 DB 或 filesystem 知识带进 renderer。
- 把一个组件膨胀成“万能编排器”。
- 在出现第二个真实用例前过早抽象。
- 本需子目录却摊平文件结构。
- 本应有独立 skill 的 typing 模式却在本地即兴发明。
