import type {
  AiPrototypeDeliverablesUpdatedPayload,
  AiPrototypeMessage,
  AiPrototypeTaskUpdatedPayload,
} from '../../shared/aiPrototype'
import { BrowserWindow } from 'electron'
import {
  AI_PROTOTYPE_DEFAULT_ASPECT_RATIO,
  AI_PROTOTYPE_DEFAULT_BASE_URL,
  AI_PROTOTYPE_DEFAULT_POLL_INTERVAL_MS,
  AI_PROTOTYPE_MODEL,
} from '../../shared/aiPrototype'
import {
  createAiPrototypeImagePair,
  downloadOutputAsset,
  getAiPrototypeMessage,
  getAiPrototypeTotals,
  getUploadBase64List,
  listAiPrototypeDeliverables,
  updateAiPrototypeMessage,
} from '../storage/providers/markdown/aiPrototype'
import { getVaultPath } from '../storage/providers/markdown/runtime/paths'
import { store } from '../store'
import { fetchGrsaiResult, submitGrsaiGenerate } from './grsaiClient'

const activePolls = new Map<string, ReturnType<typeof setTimeout>>()

function getSettings() {
  const settings = store.preferences.get('aiPrototype') as {
    apiKey?: string
    baseUrl?: string
    defaultAspectRatio?: string
    pollIntervalMs?: number
  }

  return {
    apiKey: settings?.apiKey?.trim() ?? '',
    baseUrl: settings?.baseUrl?.trim() || AI_PROTOTYPE_DEFAULT_BASE_URL,
    defaultAspectRatio:
      settings?.defaultAspectRatio?.trim() || AI_PROTOTYPE_DEFAULT_ASPECT_RATIO,
    pollIntervalMs:
      settings?.pollIntervalMs || AI_PROTOTYPE_DEFAULT_POLL_INTERVAL_MS,
  }
}

function broadcastTaskUpdated(payload: AiPrototypeTaskUpdatedPayload) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('spaces:ai-prototype:task-updated', payload)
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

function stopPoll(messageId: string) {
  const timer = activePolls.get(messageId)
  if (timer) {
    clearTimeout(timer)
    activePolls.delete(messageId)
  }
}

async function persistAndBroadcast(
  vaultPath: string,
  message: AiPrototypeMessage,
) {
  updateAiPrototypeMessage(vaultPath, message)
  broadcastTaskUpdated({
    sessionId: message.sessionId,
    message,
    totals: getAiPrototypeTotals(vaultPath),
  })
}

async function finalizeMessage(
  vaultPath: string,
  message: AiPrototypeMessage,
  status: AiPrototypeMessage['status'],
  options?: {
    progress?: number
    error?: string
    outputAssetIds?: string[]
  },
) {
  message.status = status
  message.progress = options?.progress ?? message.progress
  message.error = options?.error
  message.finishedAt = Date.now()

  if (options?.outputAssetIds) {
    message.outputAssetIds = options.outputAssetIds
  }

  await persistAndBroadcast(vaultPath, message)
  stopPoll(message.id)

  if (status === 'succeeded' && options?.outputAssetIds?.length) {
    broadcastDeliverablesUpdated({
      sessionId: message.sessionId,
      deliverables: listAiPrototypeDeliverables(vaultPath, message.sessionId),
    })
  }
}

async function pollTask(
  vaultPath: string,
  sessionId: string,
  messageId: string,
  taskId: string,
) {
  const settings = getSettings()
  const message = getAiPrototypeMessage(vaultPath, sessionId, messageId)
  if (
    !message
    || message.status === 'succeeded'
    || message.status === 'failed'
    || message.status === 'violation'
  ) {
    stopPoll(messageId)
    return
  }

  try {
    const result = await fetchGrsaiResult({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      taskId,
    })

    message.progress = result.progress ?? message.progress ?? 0

    if (result.status === 'running') {
      message.status = 'running'
      await persistAndBroadcast(vaultPath, message)
      const timer = setTimeout(() => {
        void pollTask(vaultPath, sessionId, messageId, taskId)
      }, settings.pollIntervalMs)
      activePolls.set(messageId, timer)
      return
    }

    if (result.status === 'succeeded') {
      const remoteUrls = (result.results ?? [])
        .map(item => item.url)
        .filter(Boolean)
      const outputAssetIds: string[] = []

      for (const remoteUrl of remoteUrls) {
        outputAssetIds.push(
          await downloadOutputAsset(vaultPath, sessionId, remoteUrl),
        )
      }

      await finalizeMessage(vaultPath, message, 'succeeded', {
        progress: 100,
        outputAssetIds,
      })
      return
    }

    if (result.status === 'violation') {
      await finalizeMessage(vaultPath, message, 'violation', {
        error: result.error || 'violation',
      })
      return
    }

    await finalizeMessage(vaultPath, message, 'failed', {
      error: result.error || 'GENERATE_FAILED',
    })
  }
  catch (error) {
    await finalizeMessage(vaultPath, message, 'failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function runAiPrototypeImageGeneration(
  sessionId: string,
  assistantMessageId: string,
  payload: {
    prompt: string
    uploadAssetIds: string[]
    aspectRatio: string
  },
) {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    return
  }

  const settings = getSettings()
  const message = getAiPrototypeMessage(
    vaultPath,
    sessionId,
    assistantMessageId,
  )
  if (!message) {
    return
  }

  if (!settings.apiKey) {
    await finalizeMessage(vaultPath, message, 'failed', {
      error: 'API_KEY_MISSING',
    })
    return
  }

  message.status = 'submitting'
  message.startedAt = Date.now()
  await persistAndBroadcast(vaultPath, message)

  try {
    const images = payload.uploadAssetIds.length
      ? getUploadBase64List(vaultPath, sessionId, payload.uploadAssetIds)
      : []

    const result = await submitGrsaiGenerate({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: AI_PROTOTYPE_MODEL,
      prompt: payload.prompt,
      images,
      aspectRatio: payload.aspectRatio,
    })

    message.remoteTaskId = result.id
    message.status = 'running'
    message.progress = result.progress ?? 0
    await persistAndBroadcast(vaultPath, message)

    if (!result.id) {
      throw new Error('TASK_ID_MISSING')
    }

    const timer = setTimeout(() => {
      void pollTask(vaultPath, sessionId, assistantMessageId, result.id)
    }, settings.pollIntervalMs)
    activePolls.set(assistantMessageId, timer)
  }
  catch (error) {
    await finalizeMessage(vaultPath, message, 'failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export function startAiPrototypeImageGeneration(
  sessionId: string,
  payload: {
    prompt: string
    uploadAssetIds?: string[]
    aspectRatio?: string
  },
) {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    throw new Error('VAULT_NOT_READY')
  }

  const settings = getSettings()
  if (!settings.apiKey) {
    throw new Error('API_KEY_MISSING')
  }

  const { userMessage, assistantMessage } = createAiPrototypeImagePair(
    vaultPath,
    sessionId,
    {
      prompt: payload.prompt.trim(),
      uploadAssetIds: payload.uploadAssetIds ?? [],
      aspectRatio: payload.aspectRatio?.trim() || settings.defaultAspectRatio,
      model: AI_PROTOTYPE_MODEL,
    },
  )

  void runAiPrototypeImageGeneration(sessionId, assistantMessage.id, {
    prompt: payload.prompt.trim(),
    uploadAssetIds: payload.uploadAssetIds ?? [],
    aspectRatio: payload.aspectRatio?.trim() || settings.defaultAspectRatio,
  })

  return { userMessage, assistantMessage }
}

export function disposeAiPrototypeImageTasks() {
  for (const messageId of activePolls.keys()) {
    stopPoll(messageId)
  }
}
