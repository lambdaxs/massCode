import type {
  AiOperationsChatMode,
  AiOperationsChatUpdatedPayload,
  AiOperationsDeliverable,
  AiOperationsDeliverablesUpdatedPayload,
  AiOperationsExportDeliverableResult,
  AiOperationsExportDeliverablesResult,
  AiOperationsGenerateImageResult,
  AiOperationsIndex,
  AiOperationsIndexTotals,
  AiOperationsMessage,
  AiOperationsSendChatResult,
  AiOperationsSessionMeta,
  AiOperationsSessionSummary,
  AiOperationsTaskUpdatedPayload,
  AiOperationsTemplate,
} from '~/shared/aiOperations'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { ipc, store } from '@/electron'
import { resolveAiOperationsMessageKind } from '~/shared/aiOperations'

const sessions = ref<AiOperationsSessionSummary[]>([])
const totals = ref<AiOperationsIndexTotals>({
  messages: 0,
  succeeded: 0,
  failed: 0,
  violations: 0,
})
const messages = ref<AiOperationsMessage[]>([])
const deliverables = ref<AiOperationsDeliverable[]>([])
const templates = ref<AiOperationsTemplate[]>([])
const activeSessionId = ref<string | null>(
  store.app.get<string>('aiOperations.activeSessionId') ?? null,
)
const chatMode = ref<AiOperationsChatMode>('write')
const isSending = ref(false)
const credits = ref<number | null>(null)
const isCreditsLoading = ref(false)
const isExporting = ref(false)
const assetCache = new Map<string, string>()
let initialized = false
let creditsRequestId = 0

const activeSession = computed(() => {
  return (
    sessions.value.find(item => item.id === activeSessionId.value) ?? null
  )
})

const activeTemplate = computed(() => {
  const templateId = activeSession.value?.templateId
  if (!templateId) {
    return null
  }

  return templates.value.find(item => item.id === templateId) ?? null
})

const isChatRunning = computed(() => {
  return messages.value.some((message) => {
    const kind = resolveAiOperationsMessageKind(message)
    return (
      message.role === 'assistant'
      && kind === 'chat'
      && message.status === 'running'
    )
  })
})

const isGenerating = computed(() => {
  return messages.value.some((message) => {
    const kind = resolveAiOperationsMessageKind(message)
    return (
      message.role === 'assistant'
      && kind === 'image-generation'
      && (message.status === 'pending'
        || message.status === 'submitting'
        || message.status === 'running')
    )
  })
})

function persistActiveSession() {
  store.app.set('aiOperations.activeSessionId', activeSessionId.value)
}

function applyIndex(index: AiOperationsIndex) {
  sessions.value = index.sessions
  totals.value = index.totals
}

function upsertMessage(message: AiOperationsMessage) {
  const index = messages.value.findIndex(item => item.id === message.id)
  if (index >= 0) {
    messages.value[index] = message
  }
  else {
    messages.value.push(message)
  }
  messages.value.sort((a, b) => a.createdAt - b.createdAt)
}

function upsertSessionSummary(summary: AiOperationsSessionSummary) {
  const index = sessions.value.findIndex(item => item.id === summary.id)
  if (index >= 0) {
    sessions.value[index] = summary
  }
  else {
    sessions.value.unshift(summary)
  }
  sessions.value.sort((a, b) => b.updatedAt - a.updatedAt)
}

function showAiOperationsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const knownKey = `spaces.aiOperations.errors.${message}`
  console.error('[ai-operations]', message)
  void knownKey
}

function ensureListener() {
  if (initialized) {
    return
  }

  ipc.on(
    'spaces:ai-operations:chat-updated',
    (_, payload: AiOperationsChatUpdatedPayload) => {
      if (payload.sessionId !== activeSessionId.value) {
        void refreshSessions()
        return
      }

      upsertMessage(payload.message)
      if (
        payload.message.status === 'succeeded'
        && resolveAiOperationsMessageKind(payload.message) === 'chat'
      ) {
        void refreshDeliverables(payload.sessionId)
      }
      void refreshSessions()
    },
  )

  ipc.on(
    'spaces:ai-operations:task-updated',
    (_, payload: AiOperationsTaskUpdatedPayload) => {
      if (payload.sessionId !== activeSessionId.value) {
        totals.value = payload.totals
        void refreshSessions()
        void refreshCredits()
        return
      }

      upsertMessage(payload.message)
      totals.value = payload.totals
      void refreshSessions()
      void refreshCredits()
    },
  )

  ipc.on(
    'spaces:ai-operations:deliverables-updated',
    (_, payload: AiOperationsDeliverablesUpdatedPayload) => {
      if (payload.sessionId !== activeSessionId.value) {
        return
      }

      deliverables.value = payload.deliverables
      void refreshSessions()
    },
  )

  initialized = true
}

async function refreshSessions() {
  const index = (await ipc.invoke(
    'spaces:ai-operations:list-sessions',
    null,
  )) as AiOperationsIndex
  applyIndex(index)
}

async function refreshTemplates() {
  const items = (await ipc.invoke(
    'spaces:ai-operations:list-templates',
    null,
  )) as AiOperationsTemplate[]
  templates.value = Array.isArray(items) ? items : []
}

async function refreshMessages(sessionId: string) {
  const items = (await ipc.invoke('spaces:ai-operations:get-messages', {
    sessionId,
  })) as AiOperationsMessage[]
  messages.value = Array.isArray(items) ? items : []
}

async function refreshDeliverables(sessionId: string) {
  const items = (await ipc.invoke('spaces:ai-operations:list-deliverables', {
    sessionId,
  })) as AiOperationsDeliverable[]
  deliverables.value = Array.isArray(items) ? items : []
}

async function refreshCredits() {
  const requestId = ++creditsRequestId
  isCreditsLoading.value = true

  try {
    const result = (await ipc.invoke(
      'spaces:ai-operations:get-credits',
      null,
    )) as { credits: number | null } | null

    if (requestId !== creditsRequestId) {
      return
    }

    credits.value
      = typeof result?.credits === 'number' && Number.isFinite(result.credits)
        ? result.credits
        : null
  }
  finally {
    if (requestId === creditsRequestId) {
      isCreditsLoading.value = false
    }
  }
}

async function init() {
  ensureListener()
  await Promise.all([refreshSessions(), refreshTemplates()])
  void refreshCredits()

  if (
    activeSessionId.value
    && !sessions.value.some(item => item.id === activeSessionId.value)
  ) {
    activeSessionId.value = sessions.value[0]?.id ?? null
    persistActiveSession()
  }

  if (!activeSessionId.value && sessions.value.length > 0) {
    activeSessionId.value = sessions.value[0].id
    persistActiveSession()
  }

  if (activeSessionId.value) {
    await Promise.all([
      refreshMessages(activeSessionId.value),
      refreshDeliverables(activeSessionId.value),
    ])
  }
}

async function selectSession(sessionId: string) {
  activeSessionId.value = sessionId
  persistActiveSession()
  assetCache.clear()
  await Promise.all([
    refreshMessages(sessionId),
    refreshDeliverables(sessionId),
  ])
}

async function createSession(payload?: {
  title?: string
  templateId?: string
}) {
  markPersistedStorageMutation()
  const session = (await ipc.invoke('spaces:ai-operations:create-session', {
    title: payload?.title,
    templateId: payload?.templateId,
  })) as AiOperationsSessionSummary | null
  if (!session) {
    return null
  }

  upsertSessionSummary(session)
  await selectSession(session.id)
  return session
}

async function deleteSession(sessionId: string) {
  markPersistedStorageMutation()
  await ipc.invoke('spaces:ai-operations:delete-session', { sessionId })
  sessions.value = sessions.value.filter(item => item.id !== sessionId)

  if (activeSessionId.value === sessionId) {
    activeSessionId.value = sessions.value[0]?.id ?? null
    persistActiveSession()
    messages.value = []
    deliverables.value = []
    assetCache.clear()
    if (activeSessionId.value) {
      await selectSession(activeSessionId.value)
    }
  }

  await refreshSessions()
}

async function updateSessionTemplate(templateId: string | null) {
  if (!activeSessionId.value) {
    return
  }

  markPersistedStorageMutation()
  const meta = (await ipc.invoke('spaces:ai-operations:update-session', {
    sessionId: activeSessionId.value,
    templateId,
  })) as AiOperationsSessionMeta | null

  if (meta) {
    upsertSessionSummary({
      ...meta,
      messageCount: activeSession.value?.messageCount ?? 0,
      successCount: activeSession.value?.successCount ?? 0,
      failCount: activeSession.value?.failCount ?? 0,
      deliverableCount: activeSession.value?.deliverableCount ?? 0,
    })
    await refreshSessions()
  }
}

async function sendChat(message: string) {
  if (!activeSessionId.value || isSending.value || isChatRunning.value) {
    return
  }

  isSending.value = true

  try {
    markPersistedStorageMutation()
    const result = (await ipc.invoke('spaces:ai-operations:send-chat', {
      sessionId: activeSessionId.value,
      message,
    })) as AiOperationsSendChatResult

    upsertMessage(result.userMessage)
    upsertMessage(result.assistantMessage)
  }
  catch (error) {
    showAiOperationsError(error)
    throw error
  }
  finally {
    isSending.value = false
  }
}

async function generateImage(payload: {
  prompt: string
  uploadAssetIds?: string[]
  aspectRatio?: string
}) {
  if (!activeSessionId.value || isSending.value || isGenerating.value) {
    return
  }

  isSending.value = true

  try {
    markPersistedStorageMutation()
    const result = (await ipc.invoke('spaces:ai-operations:generate-image', {
      sessionId: activeSessionId.value,
      prompt: payload.prompt,
      uploadAssetIds: payload.uploadAssetIds,
      aspectRatio: payload.aspectRatio,
    })) as AiOperationsGenerateImageResult

    upsertMessage(result.userMessage)
    upsertMessage(result.assistantMessage)
    void refreshSessions()
    void refreshCredits()
  }
  catch (error) {
    showAiOperationsError(error)
    throw error
  }
  finally {
    isSending.value = false
  }
}

async function uploadAsset(file: File): Promise<string | null> {
  if (!activeSessionId.value) {
    return null
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  markPersistedStorageMutation()
  const result = (await ipc.invoke('spaces:ai-operations:upload-asset', {
    sessionId: activeSessionId.value,
    name: file.name,
    mimeType: file.type || 'image/png',
    base64,
  })) as { assetId: string }

  return result.assetId
}

async function getDeliverableContent(fileName: string): Promise<string | null> {
  if (!activeSessionId.value) {
    return null
  }

  return (await ipc.invoke('spaces:ai-operations:get-deliverable', {
    sessionId: activeSessionId.value,
    fileName,
  })) as string | null
}

async function exportDeliverable(
  fileName: string,
  folderId: number | null,
): Promise<AiOperationsExportDeliverableResult | null> {
  if (!activeSessionId.value) {
    return null
  }

  isExporting.value = true

  try {
    markPersistedStorageMutation()
    return (await ipc.invoke('spaces:ai-operations:export-deliverable', {
      sessionId: activeSessionId.value,
      fileName,
      folderId,
    })) as AiOperationsExportDeliverableResult
  }
  finally {
    isExporting.value = false
  }
}

async function exportAllDeliverables(
  folderId: number | null,
): Promise<AiOperationsExportDeliverablesResult | null> {
  if (!activeSessionId.value) {
    return null
  }

  isExporting.value = true

  try {
    markPersistedStorageMutation()
    return (await ipc.invoke('spaces:ai-operations:export-deliverables', {
      sessionId: activeSessionId.value,
      folderId,
    })) as AiOperationsExportDeliverablesResult
  }
  finally {
    isExporting.value = false
  }
}

async function getAssetDataUrl(
  sessionId: string,
  assetId: string,
  kind: 'uploads' | 'outputs' = 'outputs',
): Promise<string | null> {
  const cacheKey = `${sessionId}:${kind}:${assetId}`
  const cached = assetCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const result = (await ipc.invoke('spaces:ai-operations:get-asset', {
    sessionId,
    assetId,
    kind,
  })) as { dataUrl: string } | null

  if (result?.dataUrl) {
    assetCache.set(cacheKey, result.dataUrl)
    return result.dataUrl
  }

  return null
}

async function createTemplate(payload: {
  name: string
  platform?: AiOperationsTemplate['platform']
  tags?: string[]
  systemPrompt: string
  defaults?: AiOperationsTemplate['defaults']
}) {
  markPersistedStorageMutation()
  const template = (await ipc.invoke('spaces:ai-operations:create-template', {
    name: payload.name,
    platform: payload.platform,
    tags: payload.tags,
    systemPrompt: payload.systemPrompt,
    defaults: payload.defaults,
  })) as AiOperationsTemplate

  await refreshTemplates()
  return template
}

async function updateTemplate(
  templateId: string,
  payload: {
    name: string
    platform?: AiOperationsTemplate['platform']
    tags?: string[]
    systemPrompt: string
    defaults?: AiOperationsTemplate['defaults']
  },
) {
  markPersistedStorageMutation()
  const template = (await ipc.invoke('spaces:ai-operations:update-template', {
    templateId,
    ...payload,
  })) as AiOperationsTemplate

  await refreshTemplates()
  return template
}

async function deleteTemplate(templateId: string) {
  markPersistedStorageMutation()
  await ipc.invoke('spaces:ai-operations:delete-template', { templateId })
  await refreshTemplates()

  if (activeSession.value?.templateId === templateId) {
    await updateSessionTemplate(null)
  }
}

async function draftTemplateFromSession(sessionId: string) {
  return (await ipc.invoke('spaces:ai-operations:draft-template-from-session', {
    sessionId,
  })) as { systemPrompt: string }
}

async function getTemplate(templateId: string) {
  return (await ipc.invoke('spaces:ai-operations:get-template', {
    templateId,
  })) as AiOperationsTemplate | null
}

export function useAiOperations() {
  ensureListener()

  return {
    sessions,
    totals,
    messages,
    deliverables,
    templates,
    activeSessionId,
    activeSession,
    activeTemplate,
    chatMode,
    isSending,
    isChatRunning,
    isGenerating,
    credits,
    isCreditsLoading,
    isExporting,
    init,
    refreshSessions,
    refreshDeliverables,
    selectSession,
    createSession,
    deleteSession,
    updateSessionTemplate,
    sendChat,
    generateImage,
    uploadAsset,
    getDeliverableContent,
    exportDeliverable,
    exportAllDeliverables,
    getAssetDataUrl,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    draftTemplateFromSession,
    getTemplate,
  }
}
