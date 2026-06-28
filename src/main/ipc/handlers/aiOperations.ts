import type {
  AiOperationsCreateSessionPayload,
  AiOperationsExportDeliverablePayload,
  AiOperationsExportDeliverablesPayload,
  AiOperationsGenerateImagePayload,
  AiOperationsSendChatPayload,
  AiOperationsSessionActionPayload,
  AiOperationsSessionMeta,
  AiOperationsUpsertTemplatePayload,
} from '../../../shared/aiOperations'
import type { AiPrototypeSettings } from '../../store/types'
import { ipcMain } from 'electron'
import { AI_OPERATIONS_DEFAULT_BASE_URL } from '../../../shared/aiOperations'
import { startAiOperationsChat } from '../../aiOperations/chatRunner'
import {
  exportAiOperationsDeliverablesToNotes,
  exportAiOperationsDeliverableToNotes,
} from '../../aiOperations/exportDeliverable'
import { startAiOperationsImageGeneration } from '../../aiOperations/imageRunner'
import { draftAiOperationsTemplateFromSession } from '../../aiOperations/templateFromSessionRunner'
import { fetchGrsaiCredits } from '../../aiPrototype/grsaiClient'
import {
  createAiOperationsSession,
  createAiOperationsTemplate,
  deleteAiOperationsSession,
  deleteAiOperationsTemplate,
  getAiOperationsTemplate,
  listAiOperationsDeliverables,
  listAiOperationsMessages,
  listAiOperationsSessions,
  listAiOperationsTemplates,
  readAiOperationsAssetBase64,
  readAiOperationsDeliverable,
  readAiOperationsSessionMeta,
  saveUploadAsset,
  updateAiOperationsSessionMeta,
  updateAiOperationsTemplate,
} from '../../storage/providers/markdown/aiOperations'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import { store } from '../../store'

export function registerAiOperationsHandlers() {
  ipcMain.handle('spaces:ai-operations:list-sessions', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return {
        sessions: [],
        totals: { messages: 0, succeeded: 0, failed: 0, violations: 0 },
      }
    }

    return listAiOperationsSessions(vaultPath)
  })

  ipcMain.handle(
    'spaces:ai-operations:create-session',
    (_, payload: AiOperationsCreateSessionPayload = {}) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      if (payload.templateId?.trim()) {
        const template = getAiOperationsTemplate(
          vaultPath,
          payload.templateId.trim(),
        )
        if (!template) {
          throw new Error('TEMPLATE_NOT_FOUND')
        }
      }

      return createAiOperationsSession(vaultPath, payload)
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:delete-session',
    (_, payload: AiOperationsSessionActionPayload) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return { deleted: false }
      }

      return {
        deleted: deleteAiOperationsSession(vaultPath, payload.sessionId),
      }
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:get-session',
    (_, payload: AiOperationsSessionActionPayload) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      return readAiOperationsSessionMeta(vaultPath, payload.sessionId)
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:update-session',
    (
      _,
      payload: AiOperationsSessionActionPayload & {
        title?: string
        templateId?: string | null
      },
    ) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      const patch: Partial<AiOperationsSessionMeta> = {}

      if (typeof payload.title === 'string') {
        patch.title = payload.title.trim() || 'Untitled'
      }

      if (payload.templateId === null) {
        patch.templateId = undefined
      }
      else if (typeof payload.templateId === 'string') {
        const templateId = payload.templateId.trim()
        if (templateId) {
          const template = getAiOperationsTemplate(vaultPath, templateId)
          if (!template) {
            throw new Error('TEMPLATE_NOT_FOUND')
          }
          patch.templateId = templateId
        }
        else {
          patch.templateId = undefined
        }
      }

      return updateAiOperationsSessionMeta(vaultPath, payload.sessionId, patch)
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:get-messages',
    (_, payload: AiOperationsSessionActionPayload) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return []
      }

      return listAiOperationsMessages(vaultPath, payload.sessionId)
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:list-deliverables',
    (_, payload: AiOperationsSessionActionPayload) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return []
      }

      return listAiOperationsDeliverables(vaultPath, payload.sessionId)
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:get-deliverable',
    (_, payload: AiOperationsSessionActionPayload & { fileName: string }) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      return readAiOperationsDeliverable(
        vaultPath,
        payload.sessionId,
        payload.fileName,
      )
    },
  )

  ipcMain.handle('spaces:ai-operations:list-templates', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return []
    }

    return listAiOperationsTemplates(vaultPath)
  })

  ipcMain.handle(
    'spaces:ai-operations:get-template',
    (_, payload: { templateId: string }) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      return getAiOperationsTemplate(vaultPath, payload.templateId)
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:create-template',
    (_, payload: AiOperationsUpsertTemplatePayload) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        throw new Error('VAULT_NOT_READY')
      }

      return createAiOperationsTemplate(vaultPath, payload)
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:update-template',
    (
      _,
      payload: AiOperationsUpsertTemplatePayload & { templateId: string },
    ) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        throw new Error('VAULT_NOT_READY')
      }

      return updateAiOperationsTemplate(vaultPath, payload.templateId, {
        name: payload.name,
        platform: payload.platform,
        tags: payload.tags,
        systemPrompt: payload.systemPrompt,
        defaults: payload.defaults,
      })
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:delete-template',
    (_, payload: { templateId: string }) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return { deleted: false }
      }

      return {
        deleted: deleteAiOperationsTemplate(vaultPath, payload.templateId),
      }
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:draft-template-from-session',
    (_, payload: AiOperationsSessionActionPayload) => {
      return draftAiOperationsTemplateFromSession(payload.sessionId)
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:get-asset',
    (
      _,
      payload: AiOperationsSessionActionPayload & {
        assetId: string
        kind?: 'uploads' | 'outputs'
      },
    ) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      return readAiOperationsAssetBase64(
        vaultPath,
        payload.sessionId,
        payload.assetId,
        payload.kind ?? 'outputs',
      )
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:upload-asset',
    (
      _,
      payload: AiOperationsSessionActionPayload & {
        name: string
        mimeType: string
        base64: string
      },
    ) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        throw new Error('VAULT_NOT_READY')
      }

      return {
        assetId: saveUploadAsset(vaultPath, payload.sessionId, {
          name: payload.name,
          mimeType: payload.mimeType,
          base64: payload.base64,
        }),
      }
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:send-chat',
    (_, payload: AiOperationsSendChatPayload) => {
      return startAiOperationsChat(payload.sessionId, payload.message)
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:generate-image',
    (_, payload: AiOperationsGenerateImagePayload) => {
      return startAiOperationsImageGeneration(payload.sessionId, {
        prompt: payload.prompt,
        uploadAssetIds: payload.uploadAssetIds,
        aspectRatio: payload.aspectRatio,
      })
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:export-deliverable',
    (_, payload: AiOperationsExportDeliverablePayload) => {
      return exportAiOperationsDeliverableToNotes(
        payload.sessionId,
        payload.fileName,
        payload.folderId,
      )
    },
  )

  ipcMain.handle(
    'spaces:ai-operations:export-deliverables',
    (_, payload: AiOperationsExportDeliverablesPayload) => {
      return exportAiOperationsDeliverablesToNotes(
        payload.sessionId,
        payload.folderId,
      )
    },
  )

  ipcMain.handle('spaces:ai-operations:get-credits', async () => {
    const settings = store.preferences.get(
      'aiPrototype',
    ) as AiPrototypeSettings
    const baseUrl = settings?.baseUrl?.trim() || AI_OPERATIONS_DEFAULT_BASE_URL

    try {
      const credits = await fetchGrsaiCredits({ baseUrl })
      return { credits }
    }
    catch {
      return { credits: null as number | null }
    }
  })
}
