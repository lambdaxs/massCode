import type {
  AiPrototypeSendMessagePayload,
  AiPrototypeSendMessageResult,
} from '../../../shared/aiPrototype'
import { ipcMain } from 'electron'
import {
  AI_PROTOTYPE_DEFAULT_ASPECT_RATIO,
  AI_PROTOTYPE_MODEL,
} from '../../../shared/aiPrototype'
import { runAiPrototypeGeneration } from '../../aiPrototype/taskRunner'
import {
  createAiPrototypeMessagePair,
  createAiPrototypeSession,
  deleteAiPrototypeSession,
  getAiPrototypeTotals,
  listAiPrototypeMessages,
  listAiPrototypeSessions,
  readAiPrototypeAssetBase64,
  saveUploadAsset,
} from '../../storage/providers/markdown/aiPrototype'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import { store } from '../../store'

export function registerAiPrototypeHandlers() {
  ipcMain.handle('spaces:ai-prototype:list-sessions', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return {
        sessions: [],
        totals: { messages: 0, succeeded: 0, failed: 0, violations: 0 },
      }
    }

    return listAiPrototypeSessions(vaultPath)
  })

  ipcMain.handle('spaces:ai-prototype:create-session', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return null
    }

    return createAiPrototypeSession(vaultPath)
  })

  ipcMain.handle(
    'spaces:ai-prototype:delete-session',
    (_, payload: { sessionId: string }) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return { deleted: false }
      }

      return {
        deleted: deleteAiPrototypeSession(vaultPath, payload.sessionId),
      }
    },
  )

  ipcMain.handle(
    'spaces:ai-prototype:get-messages',
    (_, payload: { sessionId: string }) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return []
      }

      return listAiPrototypeMessages(vaultPath, payload.sessionId)
    },
  )

  ipcMain.handle(
    'spaces:ai-prototype:get-asset',
    (
      _,
      payload: {
        sessionId: string
        assetId: string
        kind: 'uploads' | 'outputs'
      },
    ) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      return readAiPrototypeAssetBase64(
        vaultPath,
        payload.sessionId,
        payload.assetId,
        payload.kind,
      )
    },
  )

  ipcMain.handle('spaces:ai-prototype:get-stats', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return { messages: 0, succeeded: 0, failed: 0, violations: 0 }
    }

    return getAiPrototypeTotals(vaultPath)
  })

  ipcMain.handle(
    'spaces:ai-prototype:send-message',
    async (_, payload: AiPrototypeSendMessagePayload) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        throw new Error('VAULT_NOT_READY')
      }

      const settings = store.preferences.get('aiPrototype') as {
        defaultAspectRatio?: string
      }
      const aspectRatio
        = payload.aspectRatio?.trim()
          || settings?.defaultAspectRatio?.trim()
          || AI_PROTOTYPE_DEFAULT_ASPECT_RATIO

      const uploadAssetIds = (payload.uploads ?? []).map(item =>
        saveUploadAsset(vaultPath, payload.sessionId, item),
      )

      const { userMessage, assistantMessage } = createAiPrototypeMessagePair(
        vaultPath,
        payload.sessionId,
        {
          prompt: payload.prompt,
          uploadAssetIds,
          aspectRatio,
          model: AI_PROTOTYPE_MODEL,
        },
      )

      void runAiPrototypeGeneration(payload.sessionId, assistantMessage.id, {
        prompt: payload.prompt,
        uploadAssetIds,
        aspectRatio,
      })

      return {
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      } satisfies AiPrototypeSendMessageResult
    },
  )
}
