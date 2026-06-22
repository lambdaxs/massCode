# massCode Agent 入口

始终使用中文与用户交流。

massCode 是基于 Electron + Vue 3 + TypeScript 的应用，renderer 使用 TailwindCSS v4，main process 通过 Elysia 提供 API 路由；v5 以 markdown vault 存储用户内容，`store.app` / `store.preferences` 管理本地 UI 状态与设置。

## 始终生效的规则

- 遵循 YAGNI，优先最小且正确的实现，避免 speculative 抽象。
- 遵守分层边界：renderer 不得直接访问 Node.js、文件系统或 DB，应通过 API 或 IPC。
- 禁止硬编码面向用户的字符串，使用 i18n。
- 本地任务不要对整个项目跑 lint 或测试，仅覆盖受影响文件或目录。
- 修改 API DTO 或 routes 后运行 `pnpm api:generate`。
- 修改 locale 文件后运行 `pnpm i18n:copy`。
- 若任务与下方某个 skill 相关，修改前先加载该 skill。

## Skills

- `.agents/skills/architecture-standards/SKILL.md`
  仓库通用规则：架构、命名、拆分及 skill 选择。
- `.agents/skills/vue-renderer-standards/SKILL.md`
  Vue renderer：`<script setup lang="ts">`、auto-import、composables、共享状态。
- `.agents/skills/ui-foundations/SKILL.md`
  UI 基础：Tailwind v4、`UiText`、renderer 样式一致性。
- `.agents/skills/ui-primitives/SKILL.md`
  组件级 UI：`Ui*`、Shadcn、`cn`、`cva`、通知等。
- `.agents/skills/electron-api-and-ipc/SKILL.md`
  API routes、DTO、IPC handlers、Electron 集成边界。
- `.agents/skills/api-and-typing/SKILL.md`
  生成 API 类型、DTO 派生类型、何时使用本地 UI type。
- `.agents/skills/spaces-architecture/SKILL.md`
  `code` / `notes` / `math` / `tools` 等 space、markdown 状态、sync、`spaces:*` IPC。
- `.agents/skills/i18n/SKILL.md`
  本地化规则、locale key 放置、`i18n.t(...)`。
- `.agents/skills/documentation-workflow/SKILL.md`
  文档、`docs/website/documentation`、sidebar、assets、README。
- `.agents/skills/release-notes/SKILL.md`
  生成 release notes 到 `docs/releases/<tag>.md`。
- `.agents/skills/development-workflow/SKILL.md`
  仓库 workflow：scoped lint/test 及 source-of-truth 变更后的 follow-up。
- `.agents/skills/github-workflow/SKILL.md`
  git / GitHub：issue、分支、commit、PR、merge。

## 推荐加载顺序

- 范围大或不明确：先 `architecture-standards`，再加载对应 skill。
- Renderer UI：`architecture-standards` → `vue-renderer-standards` → `ui-foundations` → `ui-primitives`。
- API / IPC / Electron：`architecture-standards` → `electron-api-and-ipc`。
- 生成类型 / renderer typing：`architecture-standards` → `api-and-typing`。
- Spaces：`architecture-standards` → `spaces-architecture`。
- 文案与本地化：`i18n`。
- 文档或 README：`documentation-workflow`。
- 新版本 release notes：`release-notes`。
- Workflow 敏感任务：`development-workflow`。
- git / 分支 / commit / PR：`github-workflow`。

## 技术栈

- Framework: Vue 3, Composition API, `<script setup lang="ts">`
- Styling: TailwindCSS v4, `tailwind-merge`, `cva`
- UI: `src/renderer/components/ui`、Shadcn（reka-ui）、`lucide-vue-next`
- State: composables，无 Pinia/Vuex
- Backend: Electron main、Elysia API、markdown vault、`electron-store`
- Utilities: `@vueuse/core`, `vue-sonner`

## 代码注释语言

- 新增或修改代码注释时使用中文。
- 不要新增俄语注释。
