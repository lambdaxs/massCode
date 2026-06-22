---
name: release-notes
description: 为 GitHub release 生成 massCode release notes 时使用。写入 gitignore 文件 docs/releases/<tag>.md 供用户粘贴到 GitHub release。
---

# Release Notes

## 概述

本 skill 生成单个版本 `vX.Y.Z` 的 release notes，用于 GitHub release。目标是版本间结构一致、可重复。

不要修改 `docs/website/download/latest-release.md`，那是独立 repo 页面格式。

## Source of Truth

- 内容来自**上一 tag 到新 tag 之间 merged PR**，不要凭记忆。
- 列变更：`git log --first-parent --oneline <prev-tag>..<new-tag>`（如 `v5.5.0..v5.6.0`）。
- 新 tag 尚未创建时用 `<prev-tag>..HEAD`，并确认新版本号。
- 重要行为在代码或 `docs/website/documentation` 中核对后再写（若 PR 标题不够清楚）。

## 输出

- 写入 `docs/releases/<new-tag>.md`（如 `docs/releases/v5.6.0.md`）。`docs/releases` 在 `.gitignore`，是工作缓冲，非仓库内容。
- **写文件**，不要只在终端输出：避免终端换行破坏复制。
- 完成后简短说明路径；必要时展示摘要。**不要 commit** 该文件。

## 格式

单个 markdown 块，结构如下：

```
## <Feature Name>

<1-2 段：是什么、对用户有何用。>

## <Another Feature Name>

<1-2 段。>

## Workflow Improvements

- <小改进>
- <小改进>

## Fixes

- <修复>
- <修复>

**Full Changelog**: https://github.com/massCodeIO/massCode/compare/<prev-tag>...<new-tag>
```

结构规则：

- 直接从主题 `##` 开始。不要加 `# vX.Y.Z`（GitHub release 自带）、frontmatter 或 `<AssetsDownload />`。
- 每个重要功能或功能组一个 `##`。
- `## Workflow Improvements` 与 `## Fixes` 仅在有内容时出现。
- Compare 链接始终最后一行，tag 必须正确。

## 应包含

- User-facing 变更：新 space/功能、明显 workflow 改进、可见修复。
- 大功能单独 `##`，1-2 段说明用户价值。
- 小改进 bullet 放在 `## Workflow Improvements`。
- 修复 bullet 放在 `## Fixes`，一条一修复。

## 应省略

- 纯内部 commit：`ci`、`build`、`chore`、重构、依赖 bump、发布 housekeeping（`build: release vX.Y.Z`）。
- 例外：对用户可见的平台变更（如 macOS code signing/notarization）可放 `## Workflow Improvements`。
- 不要写实现细节；写用户结果。

## 写作风格

- **英文**，平静、事实语气。说明功能做什么、为何有用，不要营销腔。
- 不要用 em dash（仓库通用规则）。
- Space 名称一致：`Code`、`Notes`、`Math Notebook`、`Drawings`、`HTTP`、`Tools`。不要混用 `Code` 与 `Snippets` 作为 space 名。
- `snippet` 是 Code space 内的内容单元，不是 space 名。Fixes 里可写 “snippet fences”，space 仍叫 Code。
- 代码标识、扩展名、token 用反引号（`` `.excalidraw` ``、`` `@` ``、`` `Esc` ``）。
- 快捷键与 UI 一致；macOS 与 Windows/Linux 不同时分别写。

## 常见错误

- 逐条抄 commit 而非 grouped user-facing 段落。
- 纳入用户不可见的 `ci` / `build` / `chore` 噪音。
- 加 `# vX.Y.Z`、frontmatter 或 `<AssetsDownload />`。
- 只在终端输出长文而非写 `docs/releases/<new-tag>.md`。
- Commit `docs/releases` 下的文件。
- 同一文档混用 space 名称（`Code` vs `Snippets`）。
- 写实现细节而非用户价值。
- Compare 链接 tag 错误。
- 使用 em dash。
