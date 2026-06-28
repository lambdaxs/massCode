import type { AiPrototypeSettings } from '../store/types'
import { AI_PROTOTYPE_DEFAULT_CURSOR_MODEL } from '../../shared/aiPrototype'
import {
  formatSessionMessagesForSkillDraft,
  getAiPrototypeSessionWorkspace,
  listAiPrototypeMessages,
  readAiPrototypeSessionMeta,
  resolveSessionSkill,
} from '../storage/providers/markdown/aiPrototype'
import { getVaultPath } from '../storage/providers/markdown/runtime/paths'
import { store } from '../store'
import { formatCursorError, runCursorOneShotPrompt } from './cursorClient'
import { OUTPUT_LANGUAGE_RULE } from './promptTemplates'

function getCursorSettings() {
  const settings = store.preferences.get('aiPrototype') as AiPrototypeSettings

  return {
    apiKey: settings?.cursorApiKey?.trim() ?? '',
    model: settings?.cursorModel?.trim() || AI_PROTOTYPE_DEFAULT_CURSOR_MODEL,
  }
}

export async function draftAiPrototypeSkillFromSession(
  sessionId: string,
): Promise<{ systemPrompt: string }> {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    throw new Error('VAULT_NOT_READY')
  }

  const session = readAiPrototypeSessionMeta(vaultPath, sessionId)
  if (!session) {
    throw new Error('SESSION_NOT_FOUND')
  }

  const cursorSettings = getCursorSettings()
  if (!cursorSettings.apiKey) {
    throw new Error('CURSOR_API_KEY_MISSING')
  }

  const messages = listAiPrototypeMessages(vaultPath, sessionId)
  const conversation = formatSessionMessagesForSkillDraft(messages)
  if (!conversation.trim()) {
    throw new Error('SESSION_EMPTY')
  }

  const activeSkill = resolveSessionSkill(vaultPath, session)
  const skillHint = activeSkill?.systemPrompt?.trim()
    ? `\n\nCurrent skill constraints for reference:\n${activeSkill.systemPrompt.trim()}`
    : ''

  try {
    const systemPrompt = await runCursorOneShotPrompt(
      {
        ...cursorSettings,
        cwd: getAiPrototypeSessionWorkspace(vaultPath, sessionId),
        name: `ai-prototype-skill-${sessionId.slice(0, 8)}`,
      },
      `You are documenting reusable product prototype design skills.

Read the conversation below from a prototype design session. Extract a reusable skill as a system prompt for future AI sessions.

The output must:
- Be a single system prompt block in English (UI/content examples may mention Chinese)
- Capture product context, UX goals, deliverable conventions, and workflow inferred from the chat
- Include instruction to write markdown deliverables under artifacts/ and UI mockup images under assets/outputs/
- Be concise but complete enough to reproduce similar prototype work without re-discussing basics

${OUTPUT_LANGUAGE_RULE}

Conversation:
${conversation}${skillHint}

Reply with ONLY the system prompt text — no markdown fences, no explanation.`,
    )

    const trimmed = systemPrompt.trim()
    if (!trimmed) {
      throw new Error('SKILL_DRAFT_EMPTY')
    }

    return { systemPrompt: trimmed }
  }
  catch (error) {
    throw new Error(formatCursorError(error))
  }
}
