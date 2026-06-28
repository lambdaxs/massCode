import type {
  AiPrototypeCreateSessionPayload,
  AiPrototypeExportDeliverablesPayload,
  AiPrototypeExportToNotesPayload,
  AiPrototypeGenerateImagePayload,
  AiPrototypeSendChatPayload,
  AiPrototypeSessionActionPayload,
  AiPrototypeSkillActionPayload,
  AiPrototypeUpsertSkillPayload,
} from '../../../shared/aiPrototype'
import type { AiPrototypeSettings } from '../../store/types'
import { ipcMain } from 'electron'
import { AI_PROTOTYPE_DEFAULT_BASE_URL } from '../../../shared/aiPrototype'
import { startAiPrototypeChat } from '../../aiPrototype/chatRunner'
import {
  exportAiPrototypeDeliverablesToNotes,
  exportAiPrototypeDeliverableToNotes,
} from '../../aiPrototype/exportToNotes'
import { fetchGrsaiCredits } from '../../aiPrototype/grsaiClient'
import { startAiPrototypeImageGeneration } from '../../aiPrototype/imageRunner'
import { draftAiPrototypeSkillFromSession } from '../../aiPrototype/skillFromSessionRunner'
import {
  createAiPrototypeSession,
  createAiPrototypeSkill,
  deleteAiPrototypeSession,
  deleteAiPrototypeSkill,
  getAiPrototypeSkill,
  getAiPrototypeTotals,
  listAiPrototypeDeliverables,
  listAiPrototypeMessages,
  listAiPrototypeSessions,
  listAiPrototypeSkills,
  readAiPrototypeAssetBase64,
  readAiPrototypeDeliverableMarkdown,
  readAiPrototypeSessionMeta,
  saveUploadAsset,
  updateAiPrototypeSessionMeta,
  updateAiPrototypeSkill,
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

  ipcMain.handle(
    'spaces:ai-prototype:create-session',
    (_, payload?: AiPrototypeCreateSessionPayload) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      if (payload?.skillId?.trim()) {
        const skill = getAiPrototypeSkill(vaultPath, payload.skillId.trim())
        if (!skill) {
          throw new Error('SKILL_NOT_FOUND')
        }
      }

      return createAiPrototypeSession(vaultPath, payload)
    },
  )

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
    'spaces:ai-prototype:get-session',
    (_, payload: { sessionId: string }) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      return readAiPrototypeSessionMeta(vaultPath, payload.sessionId)
    },
  )

  ipcMain.handle(
    'spaces:ai-prototype:update-session',
    (
      _,
      payload: AiPrototypeSessionActionPayload & {
        title?: string
        skillId?: string | null
      },
    ) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      const patch: Parameters<typeof updateAiPrototypeSessionMeta>[2] = {}

      if (typeof payload.title === 'string') {
        patch.title = payload.title.trim() || 'Untitled'
      }

      if (payload.skillId === null) {
        patch.skillId = undefined
      }
      else if (typeof payload.skillId === 'string') {
        const skillId = payload.skillId.trim()
        if (skillId) {
          const skill = getAiPrototypeSkill(vaultPath, skillId)
          if (!skill) {
            throw new Error('SKILL_NOT_FOUND')
          }
          patch.skillId = skillId
        }
        else {
          patch.skillId = undefined
        }
      }

      return updateAiPrototypeSessionMeta(vaultPath, payload.sessionId, patch)
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
    'spaces:ai-prototype:list-deliverables',
    (_, payload: AiPrototypeSessionActionPayload) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return []
      }

      return listAiPrototypeDeliverables(vaultPath, payload.sessionId)
    },
  )

  ipcMain.handle(
    'spaces:ai-prototype:get-deliverable',
    (
      _,
      payload: AiPrototypeSessionActionPayload & { deliverableId: string },
    ) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      return readAiPrototypeDeliverableMarkdown(
        vaultPath,
        payload.sessionId,
        payload.deliverableId,
      )
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

  ipcMain.handle(
    'spaces:ai-prototype:upload-asset',
    async (
      _,
      payload: {
        sessionId: string
        name: string
        mimeType: string
        base64: string
      },
    ) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        throw new Error('VAULT_NOT_READY')
      }

      return saveUploadAsset(vaultPath, payload.sessionId, {
        name: payload.name,
        mimeType: payload.mimeType,
        base64: payload.base64,
      })
    },
  )

  ipcMain.handle('spaces:ai-prototype:get-stats', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return { messages: 0, succeeded: 0, failed: 0, violations: 0 }
    }

    return getAiPrototypeTotals(vaultPath)
  })

  ipcMain.handle('spaces:ai-prototype:get-credits', async () => {
    const settings = store.preferences.get(
      'aiPrototype',
    ) as AiPrototypeSettings
    const baseUrl = settings?.baseUrl?.trim() || AI_PROTOTYPE_DEFAULT_BASE_URL

    try {
      const credits = await fetchGrsaiCredits({ baseUrl })
      return { credits }
    }
    catch {
      return { credits: null as number | null }
    }
  })

  ipcMain.handle(
    'spaces:ai-prototype:send-chat',
    (_, payload: AiPrototypeSendChatPayload) => {
      return startAiPrototypeChat(payload.sessionId, payload.message)
    },
  )

  ipcMain.handle(
    'spaces:ai-prototype:generate-image',
    (_, payload: AiPrototypeGenerateImagePayload) => {
      return startAiPrototypeImageGeneration(payload.sessionId, {
        prompt: payload.prompt,
        uploadAssetIds: payload.uploadAssetIds,
        aspectRatio: payload.aspectRatio,
      })
    },
  )

  ipcMain.handle('spaces:ai-prototype:list-skills', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return []
    }

    return listAiPrototypeSkills(vaultPath)
  })

  ipcMain.handle(
    'spaces:ai-prototype:get-skill',
    (_, payload: AiPrototypeSkillActionPayload) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      return getAiPrototypeSkill(vaultPath, payload.skillId)
    },
  )

  ipcMain.handle(
    'spaces:ai-prototype:create-skill',
    (_, payload: AiPrototypeUpsertSkillPayload) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        throw new Error('VAULT_NOT_READY')
      }

      return createAiPrototypeSkill(vaultPath, payload)
    },
  )

  ipcMain.handle(
    'spaces:ai-prototype:update-skill',
    (
      _,
      payload: AiPrototypeSkillActionPayload & AiPrototypeUpsertSkillPayload,
    ) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        throw new Error('VAULT_NOT_READY')
      }

      return updateAiPrototypeSkill(vaultPath, payload.skillId, payload)
    },
  )

  ipcMain.handle(
    'spaces:ai-prototype:delete-skill',
    (_, payload: AiPrototypeSkillActionPayload) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return { deleted: false }
      }

      return {
        deleted: deleteAiPrototypeSkill(vaultPath, payload.skillId),
      }
    },
  )

  ipcMain.handle(
    'spaces:ai-prototype:draft-skill-from-session',
    (_, payload: AiPrototypeSessionActionPayload) => {
      return draftAiPrototypeSkillFromSession(payload.sessionId)
    },
  )

  ipcMain.handle(
    'spaces:ai-prototype:export-deliverable',
    (_, payload: AiPrototypeExportToNotesPayload) => {
      return exportAiPrototypeDeliverableToNotes(
        payload.sessionId,
        payload.deliverableId,
        payload.folderId,
      )
    },
  )

  ipcMain.handle(
    'spaces:ai-prototype:export-deliverables',
    (_, payload: AiPrototypeExportDeliverablesPayload) => {
      return exportAiPrototypeDeliverablesToNotes(
        payload.sessionId,
        payload.folderId,
      )
    },
  )
}
