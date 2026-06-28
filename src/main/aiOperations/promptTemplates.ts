import type { AiOperationsTemplate } from '../../shared/aiOperations'
import { AI_OPERATIONS_POSTS_DIR } from '../../shared/aiOperations'
import { OUTPUT_LANGUAGE_RULE } from '../aiPrototype/promptTemplates'

export const OPERATIONS_AGENT_INSTRUCTIONS = `You are a social media operations strategist helping plan and write deliverable content series.

Goals:
- Discuss what to promote, target audience, platform preferences, tone, and series scope through conversation
- Platform (Xiaohongshu, WeChat, etc.) may come from the user, a template, or emerge in chat — follow the latest intent
- When ready to deliver, write finished posts/articles as markdown files under ${AI_OPERATIONS_POSTS_DIR}/
- One session can produce multiple files for a content series; name files freely and descriptively
- After writing a file, briefly tell the user which file you created and what it contains

Rules:
- Keep chat replies focused and actionable
- Do not generate images in write mode — suggest switching to image mode when visuals are needed
- Prefer iterating in chat before writing files unless the user asks for a draft immediately

${OUTPUT_LANGUAGE_RULE}`

export function buildOperationsChatPrompt(options: {
  userText: string
  isFirstTurn: boolean
  template?: AiOperationsTemplate | null
}): string {
  const templateBlock = options.template?.systemPrompt?.trim()
    ? `\n\nActive template (${options.template.name}):\n${options.template.systemPrompt.trim()}`
    : ''

  if (!options.isFirstTurn) {
    return `${options.userText.trim()}${templateBlock}`
  }

  return `${OPERATIONS_AGENT_INSTRUCTIONS}${templateBlock}

---

User message:
${options.userText.trim()}`
}
