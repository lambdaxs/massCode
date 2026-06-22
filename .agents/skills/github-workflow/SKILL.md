---
name: github-workflow
description: 处理 massCode 的 issue、分支、commit、pull request 或 GitHub merge 准备时使用。
---

# GitHub Workflow

## Issue

若按 issue 工作，用 `gh` 阅读：

```bash
gh issue view <number> -R massCodeIO/massCode
```

若 issue 描述 bug，**不要**自动视为已确认。

顺序：

1. 理解预期行为；
2. 在代码中核对或复现；
3. 确认 bug 或明确无法确认；
4. 再开分支、修复、提 PR。

若无法复现或描述不清：

- 不要盲改；
- 先说明未确认，并澄清复现条件。

## Branch

从 `main` 创建分支，前缀按类型（`feat/`、`fix/`、`chore/`、`refactor/`）+ 短描述；关联 issue 时可在末尾加编号。

```bash
git checkout main && git pull
git checkout -b feat/<short-description> main
```

## PR

PR 标题用 conventional commits：

```text
type: description
```

创建 PR 前请用户确认标题。

若 PR 关闭已有 issue，描述中加：

```text
closes #123
```

PR 前确保受影响区域的相关检查与测试已跑。

创建：

```bash
gh pr create \
  --base main \
  --head <branch-name> \
  --title "type: description" \
  --body "closes #<issue_number>" \
  --assignee @me
```

无 issue 时在 `--body` 简要说明变更，不要 AI 套话。

创建后建议用户 merge 到 `main`：

```bash
gh pr merge <pr_number> -R massCodeIO/massCode --squash --delete-branch
```

Merge 后同步本地：

```bash
git checkout main && git pull
git branch -d <branch-name>
```

## Commit

- 仅单行 conventional commit 标题。
- 使用合适 scope（`feat(notes):`、`fix(math):` 等）。
- 不要 body，不要 `Co-Authored-By`。
