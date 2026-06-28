export const OUTPUT_LANGUAGE_RULE = `Language (mandatory):
- All assistant replies MUST be in Simplified Chinese (简体中文).
- All markdown file content you write MUST use Simplified Chinese for section headings and body text.
- Do not reply in English unless the user explicitly asks for English.`

export const REQUIREMENTS_MARKDOWN_SECTIONS = `# 产品背景

# 目标用户

# 产品目标

# 功能列表

# 约束条件

# 不在范围内`

export const PRODUCT_DOC_MARKDOWN_SECTIONS = `# 概述

# 目标用户

# 产品目标

# 功能模块

# 信息架构

# 核心用户流程

# 数据实体

# 集成边界

# 非功能需求

# 不在范围内

# 验收标准`

export const DISCOVERY_AGENT_INSTRUCTIONS = `You are a senior product manager helping define a software product before UI prototyping.

Goals:
- Clarify product background, target users, and core goals
- Produce a practical feature list with priorities
- Identify constraints and out-of-scope items
- Ask concise follow-up questions when requirements are ambiguous

Rules:
- Keep responses focused and structured
- Do not generate UI images or code
- When the user asks to finalize, write requirements to artifacts/requirements.md

${OUTPUT_LANGUAGE_RULE}`

export function buildConfirmRequirementsPrompt(): string {
  return `Based on our conversation so far, write artifacts/requirements.md in the workspace.

Use exactly these markdown sections (keep these Chinese headings verbatim):

${REQUIREMENTS_MARKDOWN_SECTIONS}

Each feature in 功能列表 should be a bullet with priority (P0/P1/P2) and a one-line description in Simplified Chinese.
Closely related modules may be grouped as one feature when they belong on the same screen.

${OUTPUT_LANGUAGE_RULE}

After writing the file, reply with a short summary of what you captured (in Simplified Chinese only).`
}

export function buildPrototypeImagePrompt(options: {
  requirementsMarkdown: string
  aspectRatio: string
  styleNote?: string
}): string {
  const styleLine = options.styleNote?.trim()
    ? `\nAdditional style notes: ${options.styleNote.trim()}`
    : ''

  return `Create a single desktop app UI prototype mockup based on the product requirements below.

Requirements:
${options.requirementsMarkdown}

Design instructions:
- One cohesive screen or a tightly grouped set of panels in one image
- Closely related modules should appear together in the layout
- Modern, minimal, professional product UI
- Clear hierarchy, readable labels, realistic layout spacing
- All UI labels, buttons, menu items, and visible text in the mockup MUST be in Simplified Chinese (简体中文)
- Light theme unless requirements say otherwise${styleLine}
- Aspect ratio: ${options.aspectRatio}`
}

export function buildDocumentGenerationPrompt(): string {
  return `Read artifacts/requirements.md and inspect prototype images under assets/outputs/ in this workspace.

Write artifacts/product-doc.md — a professional product specification for a coding agent implementing this product.

Use exactly these markdown sections (keep these Chinese headings verbatim):

${PRODUCT_DOC_MARKDOWN_SECTIONS}

Write concrete, implementation-oriented content in Simplified Chinese. Reference the prototype visuals when describing screens and flows.

${OUTPUT_LANGUAGE_RULE}

After writing the file, reply with a brief confirmation only (in Simplified Chinese).`
}

export function buildDiscoveryFollowUpPrompt(userText: string): string {
  return `${userText}

Reminder: reply in Simplified Chinese (简体中文) only.`
}
