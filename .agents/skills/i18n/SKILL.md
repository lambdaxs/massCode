---
name: i18n
description: 修改 massCode 本地化、添加面向用户的字符串、创建 locale key，或通过项目翻译系统接线文案时使用。
---

# 国际化（i18n）

## 概述

massCode 中新的用户可见文案必须走 localization system。新 key 的 source of truth 是英文 locale。

## 本地化规则

- 项目基准语言为 English。
- `en_US` 是新 key 的 source of truth。
- 新 key 先加入 `src/main/i18n/locales/en_US/`。
- 同时加入 `ru_RU`，避免俄语 locale 落后（若项目仍维护该 locale）。
- 不要在 template 或 script 中硬编码 user-facing 字符串。
- 使用 `i18n.t('namespace:key.path')`，或 default `ui` namespace 的 `i18n.t('key.path')`。
- `i18n` 从 `@/electron` import。

## Locale 变更之后

- 添加或修改 locale key 后运行 `pnpm i18n:copy`。
- 保持 `en_US` 与 `ru_RU` 同步（若维护后者）。
- 其他 locale 可由贡献者后续补齐，非每次小改的必要项。

## 常见错误

- “临时”硬编码文案。
- 新 key 不进 `en_US` 而直接写其他 locale。
- 只更新 `en_US` 忘记 `ru_RU`。
- UI 文案直接写在 template 里。
- 改 locale source-of-truth 后忘记 `pnpm i18n:copy`。
