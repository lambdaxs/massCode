import type { AiPrototypeSettings } from '../store/types'
import { AI_OPERATIONS_DEFAULT_CURSOR_MODEL } from '../../shared/aiOperations'
import {
  formatCursorError,
  runCursorOneShotPrompt,
} from '../aiPrototype/cursorClient'
import { OUTPUT_LANGUAGE_RULE } from '../aiPrototype/promptTemplates'
import {
  formatSessionMessagesForTemplateDraft,
  getAiOperationsSessionWorkspace,
  listAiOperationsMessages,
  readAiOperationsSessionMeta,
  resolveSessionTemplate,
} from '../storage/providers/markdown/aiOperations'
import { getVaultPath } from '../storage/providers/markdown/runtime/paths'
import { store } from '../store'

function getCursorSettings() {
  const settings = store.preferences.get('aiPrototype') as AiPrototypeSettings

  return {
    apiKey: settings?.cursorApiKey?.trim() ?? '',
    model: settings?.cursorModel?.trim() || AI_OPERATIONS_DEFAULT_CURSOR_MODEL,
  }
}

export async function draftAiOperationsTemplateFromSession(
  sessionId: string,
): Promise<{ systemPrompt: string }> {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    throw new Error('VAULT_NOT_READY')
  }

  const session = readAiOperationsSessionMeta(vaultPath, sessionId)
  if (!session) {
    throw new Error('SESSION_NOT_FOUND')
  }

  const cursorSettings = getCursorSettings()
  if (!cursorSettings.apiKey) {
    throw new Error('CURSOR_API_KEY_MISSING')
  }

  const messages = listAiOperationsMessages(vaultPath, sessionId)
  const conversation = formatSessionMessagesForTemplateDraft(messages)
  if (!conversation.trim()) {
    throw new Error('SESSION_EMPTY')
  }

  const activeTemplate = resolveSessionTemplate(vaultPath, session)
  const templateHint = activeTemplate?.systemPrompt?.trim()
    ? `\n\nCurrent template constraints for reference:\n${activeTemplate.systemPrompt.trim()}`
    : ''

  try {
    const systemPrompt = await runCursorOneShotPrompt(
      {
        ...cursorSettings,
        cwd: getAiOperationsSessionWorkspace(vaultPath, sessionId),
        name: `ai-ops-template-${sessionId.slice(0, 8)}`,
      },
      `You are documenting reusable social media operations playbooks.

Read the conversation below from an operations session. Extract a reusable template as a system prompt for future AI sessions.

The output must:
- Be a single system prompt block in English (platform-specific rules may mention Chinese content output)
- Capture platform preference, tone, structure, persona, and deliverable rules inferred from the chat
- Include instruction to save finished posts under artifacts/posts/ with freely chosen filenames
- Be concise but complete enough to reproduce similar content without re-discussing basics

${OUTPUT_LANGUAGE_RULE}

Conversation:
${conversation}${templateHint}

Reply with ONLY the system prompt text — no markdown fences, no explanation.`,
    )

    const trimmed = systemPrompt.trim()
    if (!trimmed) {
      throw new Error('TEMPLATE_DRAFT_EMPTY')
    }

    return { systemPrompt: trimmed }
  }
  catch (error) {
    throw new Error(formatCursorError(error))
  }
}
