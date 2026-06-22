---
name: documentation-workflow
description: 新增或更新 massCode 文档、描述新功能、修改 docs 站点页面、添加 docs 资源、更新 VitePress sidebar，或在 README 中提及功能时使用。
---

# 文档 Workflow

## 概述

massCode 文档位于 VitePress 站点 `docs/website/documentation`。README 是项目总览，不是功能细节的来源。

## 文档入口

- 功能文档：`docs/website/documentation/**`
- Sidebar：`docs/website/.vitepress/config.mts`
- 资源：`docs/website/public/**`
- 文档总览：`docs/website/documentation/index.md`
- 项目总览：`README.md`

## 核心规则

- 在代码或现有文档中验证行为；不要凭记忆写文档。
- 用 `rg` 查找相关页面、截图、快捷键、标签与已有表述。
- 目标版本已知则用该版本；未知则不要编造。
- 用户文档站点用**英文**，风格与现有 docs 一致。
- 新增或更新 `docs/website/documentation` 中最具体的页面。
- 新页面使用带 `title`、`description` 的 frontmatter。
- 功能仅某版本起可用时，在页首附近加 `<AppVersion text=">=x.y" />`。
- 仅当需要出现在导航时，才在 `config.mts` 注册页面。
- 仅从 `index.md` 链接**跨 cutting** 的广泛功能。
- 短段落、面向任务；优先用户流程，而非实现细节。
- 快捷键用 `<kbd>...</kbd>`；macOS 与 Windows/Linux 不同时分别写明。

## VitePress Markdown 注意点

- VitePress 将 markdown 编译为 Vue 组件，`{{ ... }}` 会被当作 Vue 插值并**消失**。
- 围栏代码块（` ``` `）自动保护，其中 `{{var}}` 字面输出。
- **行内反引号代码不保护**：`` `{{variables}}` `` 会渲染为空。要在正文或表格中输出字面 `{{ }}`，用 `v-pre`：
  `<code v-pre>{{variables}}</code>`
- 正文中的其他 Vue 构造（`{{ }}`、指令）同理。

## 图片与资源

- 文档图片放在 `docs/website/public`。
- 引用示例：`<img :src="withBase('/feature.png')">`
- 使用 `withBase` 时在 script 中：`import { withBase } from 'vitepress'`
- 仅当截图能说明功能时使用；不要装饰性图片。

## README 规则

- 仅对 README 级总览重要的 user-facing 功能写提及。
- README 保持简短、产品级；详细用法在 `docs/website/documentation`。
- README 不写功能引入版本；版本信息放在 docs 或 release notes。
- 不要自动把新功能放在第一位；保持现有信息架构：先主要 spaces/features，再广泛 workflow helpers（除非用户另有要求）。

## 验证

- 运行 `git diff --check`。
- docs 站点变更后运行 `pnpm -C docs/website build`。
- 格式化仅作用于改动文件，避免 config 大范围 churn。
- 无用户明确要求不要 commit；commit/PR 见 `github-workflow`。

## 常见错误

- 只需 docs page 的功能却只写 README。
- 新页面该进导航却忘记 VitePress sidebar。
- 在 README 写 version availability。
- 未核对实现就写快捷键或行为。
- 跑宽 formatter 改写 docs config 既有风格。
- 行内代码写字面 `{{ }}` 却不用 `v-pre`。
