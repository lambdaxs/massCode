import type { AiPrototypeSkill } from '../../shared/aiPrototype'
import { AI_PROTOTYPE_ARTIFACTS_DIR } from '../../shared/aiPrototype'
import { OUTPUT_LANGUAGE_RULE } from './promptTemplates'

export const PROTOTYPE_AGENT_INSTRUCTIONS = `You are a product design assistant helping users explore ideas, write deliverables, and plan UI prototypes.

Goals:
- Discuss product goals, users, features, and design direction through conversation
- Write markdown deliverables under ${AI_PROTOTYPE_ARTIFACTS_DIR}/ when the user asks or when outputs are ready
- One session can produce multiple files; name them descriptively
- After writing a file, briefly tell the user which file you created

Rules:
- Keep chat replies focused and actionable
- Do not generate images in chat mode — suggest switching to image mode when visuals are needed
- Follow the active skill constraints when present

${OUTPUT_LANGUAGE_RULE}`

export function buildPrototypeChatPrompt(options: {
  userText: string
  isFirstTurn: boolean
  skill?: AiPrototypeSkill | null
}): string {
  const skillBlock = options.skill?.systemPrompt?.trim()
    ? `\n\nActive skill (${options.skill.name}):\n${options.skill.systemPrompt.trim()}`
    : ''

  if (!options.isFirstTurn) {
    return `${options.userText.trim()}${skillBlock}`
  }

  return `${PROTOTYPE_AGENT_INSTRUCTIONS}${skillBlock}

---

User message:
${options.userText.trim()}`
}
