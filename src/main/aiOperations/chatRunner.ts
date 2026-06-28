import type {
  AiOperationsChatUpdatedPayload,
  AiOperationsDeliverablesUpdatedPayload,
  AiOperationsMessage,
  AiOperationsSendChatResult,
} from '../../shared/aiOperations'
import type { AiPrototypeSettings } from '../store/types'
import { BrowserWindow } from 'electron'
import { AI_OPERATIONS_DEFAULT_CURSOR_MODEL } from '../../shared/aiOperations'
import {
  formatCursorError,
  runCursorAgentMessage,
} from '../aiPrototype/cursorClient'
import {
  createAiOperationsChatPair,
  createAiOperationsDeliverableMessage,
  getAiOperationsSessionWorkspace,
  listAiOperationsDeliverables,
  listDeliverableFileNames,
  readAiOperationsSessionMeta,
  resolveSessionTemplate,
  updateAiOperationsMessage,
  updateAiOperationsSessionMeta,
} from '../storage/providers/markdown/aiOperations'
import { getVaultPath } from '../storage/providers/markdown/runtime/paths'
import { store } from '../store'
import { buildOperationsChatPrompt } from './promptTemplates'

const activeChatSessions = new Set<string>()

function getCursorSettings(): {
  apiKey: string
  model: string
} {
  const settings = store.preferences.get('aiPrototype') as AiPrototypeSettings

  return {
    apiKey: settings?.cursorApiKey?.trim() ?? '',
    model: settings?.cursorModel?.trim() || AI_OPERATIONS_DEFAULT_CURSOR_MODEL,
  }
}

function broadcastChatUpdated(payload: AiOperationsChatUpdatedPayload) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('spaces:ai-operations:chat-updated', payload)
    }
  })
}

function broadcastDeliverablesUpdated(
  payload: AiOperationsDeliverablesUpdatedPayload,
) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(
        'spaces:ai-operations:deliverables-updated',
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

  const session = readAiOperationsSessionMeta(vaultPath, sessionId)
  if (!session) {
    throw new Error('SESSION_NOT_FOUND')
  }

  const cursorSettings = getCursorSettings()
  if (!cursorSettings.apiKey) {
    throw new Error('CURSOR_API_KEY_MISSING')
  }

  return { vaultPath, session, cursorSettings }
}

async function syncNewDeliverables(
  vaultPath: string,
  sessionId: string,
  before: Set<string>,
) {
  const after = listDeliverableFileNames(vaultPath, sessionId)
  const newFiles = after.filter(fileName => !before.has(fileName))

  for (const fileName of newFiles) {
    const message = createAiOperationsDeliverableMessage(
      vaultPath,
      sessionId,
      fileName,
    )
    broadcastChatUpdated({ sessionId, message })
  }

  if (newFiles.length > 0) {
    broadcastDeliverablesUpdated({
      sessionId,
      deliverables: listAiOperationsDeliverables(vaultPath, sessionId),
    })
  }
}

async function finishAiOperationsChat(
  sessionId: string,
  userText: string,
  assistantMessage: AiOperationsMessage,
  beforeDeliverables: Set<string>,
) {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    return
  }

  const session = readAiOperationsSessionMeta(vaultPath, sessionId)
  if (!session) {
    return
  }

  const cursorSettings = getCursorSettings()
  const template = resolveSessionTemplate(vaultPath, session)

  try {
    const { text, agentId } = await runCursorAgentMessage(
      {
        ...cursorSettings,
        cwd: getAiOperationsSessionWorkspace(vaultPath, sessionId),
        cursorAgentId: session.cursorAgentId,
        name: `ai-ops-${sessionId.slice(0, 8)}`,
      },
      buildOperationsChatPrompt({
        userText,
        isFirstTurn: !session.cursorAgentId,
        template,
      }),
    )

    assistantMessage.content = text
    assistantMessage.status = 'succeeded'
    assistantMessage.error = undefined
    assistantMessage.finishedAt = Date.now()
    updateAiOperationsMessage(vaultPath, assistantMessage)

    updateAiOperationsSessionMeta(vaultPath, sessionId, {
      cursorAgentId: agentId,
    })

    await syncNewDeliverables(vaultPath, sessionId, beforeDeliverables)
  }
  catch (error) {
    assistantMessage.status = 'failed'
    assistantMessage.error = formatCursorError(error)
    assistantMessage.finishedAt = Date.now()
    updateAiOperationsMessage(vaultPath, assistantMessage)
  }
  finally {
    activeChatSessions.delete(sessionId)
    broadcastChatUpdated({ sessionId, message: assistantMessage })
  }
}

export function startAiOperationsChat(
  sessionId: string,
  userText: string,
): AiOperationsSendChatResult {
  const { vaultPath } = assertChatSession(sessionId)

  if (activeChatSessions.has(sessionId)) {
    throw new Error('CHAT_ALREADY_RUNNING')
  }

  const beforeDeliverables = new Set(
    listDeliverableFileNames(vaultPath, sessionId),
  )

  const { userMessage, assistantMessage } = createAiOperationsChatPair(
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

  void finishAiOperationsChat(
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

export function isAiOperationsChatRunning(sessionId: string): boolean {
  return activeChatSessions.has(sessionId)
}
