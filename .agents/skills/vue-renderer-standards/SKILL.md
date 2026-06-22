---
name: vue-renderer-standards
description: 编辑 massCode Vue 3 renderer 代码时使用，尤其是 script setup、import 规则、composables、共享状态与 renderer 约定。
---

# Vue Renderer 规范

## 概述

Renderer 基于 Vue 3 Composition API 与 `<script setup lang="ts">`。须遵守严格 import 规则、composable-first 共享状态，且禁止直连 backend。

## 组件模式

- 使用 Vue 3 Composition API 与 `<script setup lang="ts">`。
- Vue core（`ref`、`computed`、`watch`、`onMounted` 等）**不要**手动 import：已 auto-import。
- `src/renderer/components/` 下项目组件**不要**手动 import：已 auto-import。
- 局部逻辑放在 script，不要堆在 template。

## 仅必要时手动 Import

始终手动 import：

- `@/composables` 中的 composables；
- `@/utils` 中的 utils；
- `@vueuse/core`；
- `@/electron` 的 Electron bridge；
- `@/components/ui/shadcn/*` 的 Shadcn UI。

## 共享状态

- 全局共享状态用 composables，无 Pinia/Vuex。
- 需在组件间共享的 reactive state 声明在 **module level**（composable 导出函数之外）。
- 持久 UI/设置状态用 `@/electron` 的 `store`：
  - `store.app` — UI state；
  - `store.preferences` — 用户偏好。

## VueUse 优先

- 写新 composable 前先查 `@vueuse/core` 是否已有。
- 仅当确实没有合适 utility 时才自定义。

## Renderer 边界

- Renderer **不** import storage internals 或直接访问数据的 backend 模块。
- Renderer **不**直接访问 Node.js、filesystem、storage runtime。
- 访问 main process 仅通过 `api` 或 `ipc`。

## 常见错误

- 手动 import `ref` / `computed` / `watch`。
- 手动 import 本地 project components。
- 本应在多组件共享的状态写在 composable 函数内部。
- 在 renderer “抄近路” import backend 模块。
