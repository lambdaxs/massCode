---
name: ui-foundations
description: 定义或审查 massCode UI 基础规则（typography、renderer 样式一致性、TailwindCSS v4），或原始 markup 与既有 UI 文本模式冲突时使用。
---

# UI 基础

## 概述

massCode UI 须保持视觉一致。本 skill 涵盖基础 styling：typography、何时用 established text patterns、如何避免 renderer 样式各自为政。

## 核心规则

- Renderer 基础 styling 基于 **TailwindCSS v4**。
- 新屏幕与状态应延续现有 visual language，不要为单点发明局部规则。
- 标准 app UI 优先用语义 token：`bg-background`、`text-muted-foreground`、`border-border`、`border-destructive/*`，而非 `bg-white`、`text-black` 等 raw palette。
- 默认 typography 用 **`UiText`**。
- 已有 variant 适用时，不要用随意 `text-*`、`font-*` 替代 `UiText`。
- `UiText` 接近可用时，在其上加点 class，而非 raw typography markup。

## Typography

- `UiText` 是文本尺寸与 muted 状态的基准。
- `caption`、`xs` — 说明、helper、secondary label。
- `sm`、`base` — 主界面正文。
- `lg`、`xl` — 需要 hierarchy 时的强化 title/value。
- `font-mono` — 仅 code-like content、ID、对齐计数、readonly 生成输出等。
- uppercase label 用既有 `UiText` 或一致 tracking/uppercase，不要每处乱拼 utility。

## 间距与布局节奏

- 根 screen/container 常用 `space-y-4` 或 `space-y-6`。
- 紧凑区块内常用 `space-y-2` 或 `space-y-3`。
- Grid gap 默认：`gap-2`、`gap-3`、`gap-4`（按密度）。
- 已有间隔够用就不要为新屏发明 spacing scale。
- 重复 content block 的 padding、vertical rhythm 应一致。

## 圆角与阴影

- `rounded-md` — control、inline box、紧凑容器。
- `rounded-lg` — card、dialog、overlay、dashboard section。
- `rounded-xl` — 预览为主的大块 surface。
- `rounded-full` — pill、badge、圆形 handle。
- `shadow-xs` — input、button、小 control。
- `shadow-md`、`shadow-lg` — overlay、popover、预览（确需 elevation 时）。
- 标准 token 够用就不要随意 `rounded-[...]`、`shadow-[...]`。

## 例外

- Raw color 可用于数据或 preview 本身的一部分：取色器、对比预览、code/image 导出背景、可视化节点等。
- 颜色来自内容或需保证对比度时，raw class 或 inline style 可接受。
- 例外不能成为把 raw palette 带进普通 app chrome 的借口。

## 何时优先本 Skill

- 新 UI 如何排版文本与标签。
-  tempted 用 raw Tailwind typography 而非既有 text pattern。
- 某屏出现与整体 renderer 不一致的局部 styling。
- 需在视觉层决策，而非具体 button/input/dialog。

## 常见错误

- 功能间散落局部视觉例外。
- 无充分理由在普通 app UI 用 raw palette。
- 该用 `UiText` 处写随意 utility。
- 新屏自造 spacing rhythm。
- 小 control 圆角与 preview surface 圆角混用。
- 把 Tailwind 当成每屏从零设计的借口。
