import type {
  AiPrototypeChatUpdatedPayload,
  AiPrototypeDeliverablesUpdatedPayload,
  AiPrototypeMessage,
  AiPrototypeSendChatResult,
} from '../../shared/aiPrototype'
import type { AiPrototypeSettings } from '../store/types'
import { BrowserWindow } from 'electron'
import { AI_PROTOTYPE_DEFAULT_CURSOR_MODEL } from '../../shared/aiPrototype'
import {
  createAiPrototypeChatPair,
  createAiPrototypeDeliverableMessage,
  getAiPrototypeSessionWorkspace,
  listAiPrototypeDeliverables,
  listArtifactMarkdownIds,
  readAiPrototypeSessionMeta,
  resolveSessionSkill,
  updateAiPrototypeMessage,
  updateAiPrototypeSessionMeta,
} from '../storage/providers/markdown/aiPrototype'
import { getVaultPath } from '../storage/providers/markdown/runtime/paths'
import { store } from '../store'
import { formatCursorError, runCursorAgentMessage } from './cursorClient'
import { buildPrototypeChatPrompt } from './prototypePromptTemplates'

const activeChatSessions = new Set<string>()

function getCursorSettings(): {
  apiKey: string
  model: string
} {
  const settings = store.preferences.get('aiPrototype') as AiPrototypeSettings

  return {
    apiKey: settings?.cursorApiKey?.trim() ?? '',
    model: settings?.cursorModel?.trim() || AI_PROTOTYPE_DEFAULT_CURSOR_MODEL,
  }
}

function broadcastChatUpdated(payload: AiPrototypeChatUpdatedPayload) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('spaces:ai-prototype:chat-updated', payload)
    }
  })
}

function broadcastDeliverablesUpdated(
  payload: AiPrototypeDeliverablesUpdatedPayload,
) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(
        'spaces:ai-prototype:deliverables-updated',
        payload,
      )
    }
  })
}

function assertChatSession(sessionId: string) {
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

  return { vaultPath, session, cursorSettings }
}

async function syncDeliverablesAfterChat(
  vaultPath: string,
  sessionId: string,
  before: Set<string>,
) {
  const after = listArtifactMarkdownIds(vaultPath, sessionId)
  const newIds = after.filter(id => !before.has(id))

  for (const deliverableId of newIds) {
    const message = createAiPrototypeDeliverableMessage(
      vaultPath,
      sessionId,
      deliverableId,
    )
    broadcastChatUpdated({ sessionId, message })
  }

  broadcastDeliverablesUpdated({
    sessionId,
    deliverables: listAiPrototypeDeliverables(vaultPath, sessionId),
  })
}

async function finishAiPrototypeChat(
  sessionId: string,
  userText: string,
  assistantMessage: AiPrototypeMessage,
  beforeDeliverables: Set<string>,
) {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    return
  }

  const session = readAiPrototypeSessionMeta(vaultPath, sessionId)
  if (!session) {
    return
  }

  const cursorSettings = getCursorSettings()
  const skill = resolveSessionSkill(vaultPath, session)

  try {
    const { text, agentId } = await runCursorAgentMessage(
      {
        ...cursorSettings,
        cwd: getAiPrototypeSessionWorkspace(vaultPath, sessionId),
        cursorAgentId: session.cursorAgentId,
        name: `ai-proto-${sessionId.slice(0, 8)}`,
      },
      buildPrototypeChatPrompt({
        userText,
        isFirstTurn: !session.cursorAgentId,
        skill,
      }),
    )

    assistantMessage.content = text
    assistantMessage.status = 'succeeded'
    assistantMessage.error = undefined
    assistantMessage.finishedAt = Date.now()
    updateAiPrototypeMessage(vaultPath, assistantMessage)

    updateAiPrototypeSessionMeta(vaultPath, sessionId, {
      cursorAgentId: agentId,
    })

    await syncDeliverablesAfterChat(vaultPath, sessionId, beforeDeliverables)
  }
  catch (error) {
    assistantMessage.status = 'failed'
    assistantMessage.error = formatCursorError(error)
    assistantMessage.finishedAt = Date.now()
    updateAiPrototypeMessage(vaultPath, assistantMessage)
  }
  finally {
    activeChatSessions.delete(sessionId)
    broadcastChatUpdated({ sessionId, message: assistantMessage })
  }
}

export function startAiPrototypeChat(
  sessionId: string,
  userText: string,
): AiPrototypeSendChatResult {
  const { vaultPath } = assertChatSession(sessionId)

  if (activeChatSessions.has(sessionId)) {
    throw new Error('CHAT_ALREADY_RUNNING')
  }

  const beforeDeliverables = new Set(
    listArtifactMarkdownIds(vaultPath, sessionId),
  )

  const { userMessage, assistantMessage } = createAiPrototypeChatPair(
    vaultPath,
    sessionId,
    {
      userText,
      assistantStatus: 'running',
    },
  )

  activeChatSessions.add(sessionId)
  broadcastChatUpdated({ sessionId, message: userMessage })
  broadcastChatUpdated({ sessionId, message: assistantMessage })

  void finishAiPrototypeChat(
    sessionId,
    userText,
    assistantMessage,
    beforeDeliverables,
  )

  return {
    userMessage,
    assistantMessage,
  }
}

export function isAiPrototypeChatRunning(sessionId: string): boolean {
  return activeChatSessions.has(sessionId)
}
