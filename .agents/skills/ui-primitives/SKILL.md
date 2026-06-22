---
name: ui-primitives
description: 用本地 Ui primitives 或 Shadcn 构建/重构 massCode UI 组件时使用，尤其是 cn、cva、通知，以及避免重复实现基础控件。
---

# UI Primitives

## 概述

基础 UI 应来自现有 **`Ui*`** 组件与 Shadcn 模式。本 skill 是**组件级**用法，不是整体视觉基础（见 `ui-foundations`）。

## 组件用法

- 本地 UI 通过 auto-import，前缀 `Ui`。
- button、input、checkbox、action button 等有现成 `Ui*` 时不要裸 HTML 重写。
- 缺组件时先在 `src/renderer/components/ui/` 创建，再在 feature 中使用。

## Buttons

- Primary action 应明确，同一容器不要多个同等 CTA 争抢。
- 仅图标 action 需上下文可懂，并有 tooltip 或其他 accessible label。
- Loading/pending 用既有 button pattern，不要 ad-hoc “disabled 换文案”。
- Destructive action 视觉上应区别于普通 secondary。

## Cards 与容器

- 独立 panel-like 块用已有 `Card` / `Ui*` container（若该区域已有）。
- 内部 muted block 不要每处用不同 `div` 模式重搭。
- 重复 panel 结构应抽到 shared 或 feature primitive，不要 markup 复制粘贴。

## 只读与可复制内容

- 长 readonly output、生成文本、URL 等不要用“普通 disabled input”展示（若损害可读性）。
- Copy flow 用既有 copy pattern + `useSonner()` 通知。
- Readonly 内容须易读、易复制。

## Styling Helpers

- Variants 用 **`cva`**。
- 拼 class 用 **`cn()`**。
- 需要 variant API 处不要用字符串 `if` 链硬写。

## Shadcn 规则

- Shadcn 从 `@/components/ui/shadcn/*` 手动 import。
- Namespace 组件示例：`import * as Dialog from '@/components/ui/shadcn/dialog'`。

## 通知

- 用 **`useSonner()`**。
- Feature 内不要并行自建 toast 系统。

## Tooltip、Popover、Overlay

- Tooltip — 短说明。
- Popover —  richer 内联内容、picker、上下文控件。
- 无必要不要用 ad-hoc overlay 替代。
- Validation、inline guidance 用已有 tooltip/popover（若项目已在类似场景使用）。

## 常见错误

- “更快”而从零写 button/input。
- 复杂 conditional class 不用 `cn()`。
- 在 feature 目录复制已有 primitive，而非用 `src/renderer/components/ui/`。
- 把 disabled input 当通用 readonly 展示面。
- 已有 Shadcn primitive 处手写 overlay。
- 把 primitives 规则与应属 `ui-foundations` 的视觉问题混谈。
