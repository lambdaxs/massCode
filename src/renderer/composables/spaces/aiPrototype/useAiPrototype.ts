import type {
  AiPrototypeChatMode,
  AiPrototypeChatUpdatedPayload,
  AiPrototypeDeliverable,
  AiPrototypeDeliverablesUpdatedPayload,
  AiPrototypeExportDeliverablesResult,
  AiPrototypeExportToNotesResult,
  AiPrototypeGenerateImageResult,
  AiPrototypeIndex,
  AiPrototypeIndexTotals,
  AiPrototypeMessage,
  AiPrototypeSendChatResult,
  AiPrototypeSessionSummary,
  AiPrototypeSkill,
  AiPrototypeTaskUpdatedPayload,
} from '~/shared/aiPrototype'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { ipc, store } from '@/electron'
import { resolveAiPrototypeMessageKind } from '~/shared/aiPrototype'

const sessions = ref<AiPrototypeSessionSummary[]>([])
const totals = ref<AiPrototypeIndexTotals>({
  messages: 0,
  succeeded: 0,
  failed: 0,
  violations: 0,
})
const messages = ref<AiPrototypeMessage[]>([])
const deliverables = ref<AiPrototypeDeliverable[]>([])
const skills = ref<AiPrototypeSkill[]>([])
const activeSessionId = ref<string | null>(
  store.app.get<string>('aiPrototype.activeSessionId') ?? null,
)
const chatMode = ref<AiPrototypeChatMode>('chat')
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

const activeSkill = computed(() => {
  const skillId = activeSession.value?.skillId
  if (!skillId) {
    return null
  }

  return skills.value.find(item => item.id === skillId) ?? null
})

const isChatRunning = computed(() => {
  return messages.value.some((message) => {
    const kind = resolveAiPrototypeMessageKind(message)
    return (
      message.role === 'assistant'
      && kind === 'chat'
      && message.status === 'running'
    )
  })
})

const isGenerating = computed(() => {
  return messages.value.some((message) => {
    const kind = resolveAiPrototypeMessageKind(message)
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
  store.app.set('aiPrototype.activeSessionId', activeSessionId.value)
}

function applyIndex(index: AiPrototypeIndex) {
  sessions.value = index.sessions
  totals.value = index.totals
}

function upsertMessage(message: AiPrototypeMessage) {
  const index = messages.value.findIndex(item => item.id === message.id)
  if (index >= 0) {
    messages.value[index] = message
  }
  else {
    messages.value.push(message)
  }
  messages.value.sort((a, b) => a.createdAt - b.createdAt)
}

function ensureListener() {
  if (initialized) {
    return
  }

  ipc.on(
    'spaces:ai-prototype:chat-updated',
    (_, payload: AiPrototypeChatUpdatedPayload) => {
      if (payload.sessionId !== activeSessionId.value) {
        void refreshSessions()
        return
      }

      upsertMessage(payload.message)
      if (
        payload.message.status === 'succeeded'
        && resolveAiPrototypeMessageKind(payload.message) === 'chat'
      ) {
        void refreshDeliverables(payload.sessionId)
      }
      void refreshSessions()
    },
  )

  ipc.on(
    'spaces:ai-prototype:task-updated',
    (_, payload: AiPrototypeTaskUpdatedPayload) => {
      if (payload.sessionId !== activeSessionId.value) {
        totals.value = payload.totals
        void refreshSessions()
        void refreshCredits()
        return
      }

      upsertMessage(payload.message)
      totals.value = payload.totals
      if (payload.message.status === 'succeeded') {
        void refreshDeliverables(payload.sessionId)
      }
      void refreshSessions()
      void refreshCredits()
    },
  )

  ipc.on(
    'spaces:ai-prototype:deliverables-updated',
    (_, payload: AiPrototypeDeliverablesUpdatedPayload) => {
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
    'spaces:ai-prototype:list-sessions',
    null,
  )) as AiPrototypeIndex
  applyIndex(index)
}

async function refreshSkills() {
  const items = (await ipc.invoke(
    'spaces:ai-prototype:list-skills',
    null,
  )) as AiPrototypeSkill[]
  skills.value = Array.isArray(items) ? items : []
}

async function refreshMessages(sessionId: string) {
  const items = (await ipc.invoke('spaces:ai-prototype:get-messages', {
    sessionId,
  })) as AiPrototypeMessage[]
  messages.value = Array.isArray(items) ? items : []
}

async function refreshDeliverables(sessionId: string) {
  const items = (await ipc.invoke('spaces:ai-prototype:list-deliverables', {
    sessionId,
  })) as AiPrototypeDeliverable[]
  deliverables.value = Array.isArray(items) ? items : []
}

async function refreshCredits() {
  const requestId = ++creditsRequestId
  isCreditsLoading.value = true

  try {
    const result = (await ipc.invoke(
      'spaces:ai-prototype:get-credits',
      null,
    )) as { credits: number | null }
    if (requestId === creditsRequestId) {
      credits.value = result?.credits ?? null
    }
  }
  finally {
    if (requestId === creditsRequestId) {
      isCreditsLoading.value = false
    }
  }
}

async function init() {
  ensureListener()
  await Promise.all([refreshSessions(), refreshSkills(), refreshCredits()])

  if (activeSessionId.value) {
    const exists = sessions.value.some(
      item => item.id === activeSessionId.value,
    )
    if (!exists) {
      activeSessionId.value = sessions.value[0]?.id ?? null
      persistActiveSession()
    }
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
  await Promise.all([
    refreshMessages(sessionId),
    refreshDeliverables(sessionId),
  ])
}

async function createSession(payload?: { title?: string, skillId?: string }) {
  markPersistedStorageMutation()
  const session = (await ipc.invoke(
    'spaces:ai-prototype:create-session',
    payload ?? null,
  )) as AiPrototypeSessionSummary | null

  if (!session) {
    return null
  }

  await refreshSessions()
  await selectSession(session.id)
  return session
}

async function deleteSession(sessionId: string) {
  markPersistedStorageMutation()
  await ipc.invoke('spaces:ai-prototype:delete-session', { sessionId })
  await refreshSessions()

  if (activeSessionId.value === sessionId) {
    activeSessionId.value = sessions.value[0]?.id ?? null
    persistActiveSession()
    messages.value = []
    deliverables.value = []

    if (activeSessionId.value) {
      await Promise.all([
        refreshMessages(activeSessionId.value),
        refreshDeliverables(activeSessionId.value),
      ])
    }
  }
}

async function updateSessionSkill(skillId: string | null) {
  if (!activeSessionId.value) {
    return
  }

  markPersistedStorageMutation()
  await ipc.invoke('spaces:ai-prototype:update-session', {
    sessionId: activeSessionId.value,
    skillId,
  })
  await refreshSessions()
}

async function sendChat(message: string) {
  if (!activeSessionId.value) {
    return null
  }

  isSending.value = true

  try {
    const result = (await ipc.invoke('spaces:ai-prototype:send-chat', {
      sessionId: activeSessionId.value,
      message,
    })) as AiPrototypeSendChatResult

    upsertMessage(result.userMessage)
    upsertMessage(result.assistantMessage)
    return result
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
  if (!activeSessionId.value) {
    return null
  }

  isSending.value = true

  try {
    const result = (await ipc.invoke('spaces:ai-prototype:generate-image', {
      sessionId: activeSessionId.value,
      prompt: payload.prompt,
      uploadAssetIds: payload.uploadAssetIds,
      aspectRatio: payload.aspectRatio,
    })) as AiPrototypeGenerateImageResult

    upsertMessage(result.userMessage)
    upsertMessage(result.assistantMessage)
    return result
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
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  markPersistedStorageMutation()
  return (await ipc.invoke('spaces:ai-prototype:upload-asset', {
    sessionId: activeSessionId.value,
    name: file.name,
    mimeType: file.type || 'image/png',
    base64,
  })) as string
}

async function getDeliverableContent(deliverableId: string) {
  if (!activeSessionId.value) {
    return null
  }

  return (await ipc.invoke('spaces:ai-prototype:get-deliverable', {
    sessionId: activeSessionId.value,
    deliverableId,
  })) as string | null
}

async function exportDeliverable(
  deliverableId: string,
  folderId: number | null,
) {
  if (!activeSessionId.value) {
    return null
  }

  isExporting.value = true

  try {
    markPersistedStorageMutation()
    return (await ipc.invoke('spaces:ai-prototype:export-deliverable', {
      sessionId: activeSessionId.value,
      deliverableId,
      folderId,
    })) as AiPrototypeExportToNotesResult
  }
  finally {
    isExporting.value = false
  }
}

async function exportAllDeliverables(folderId: number | null) {
  if (!activeSessionId.value) {
    return null
  }

  isExporting.value = true

  try {
    markPersistedStorageMutation()
    return (await ipc.invoke('spaces:ai-prototype:export-deliverables', {
      sessionId: activeSessionId.value,
      folderId,
    })) as AiPrototypeExportDeliverablesResult
  }
  finally {
    isExporting.value = false
  }
}

async function getAssetDataUrl(
  assetId: string,
  kind: 'uploads' | 'outputs' = 'outputs',
  revision?: number,
) {
  if (!activeSessionId.value) {
    return null
  }

  const cacheKey = `${activeSessionId.value}:${kind}:${assetId}:${revision ?? 0}`
  if (assetCache.has(cacheKey)) {
    return assetCache.get(cacheKey) ?? null
  }

  const result = (await ipc.invoke('spaces:ai-prototype:get-asset', {
    sessionId: activeSessionId.value,
    assetId,
    kind,
  })) as { dataUrl: string } | null

  if (result?.dataUrl) {
    assetCache.set(cacheKey, result.dataUrl)
    return result.dataUrl
  }

  return null
}

async function createSkill(payload: {
  name: string
  tags?: string[]
  systemPrompt: string
  defaults?: AiPrototypeSkill['defaults']
  deliverableHints?: string[]
}) {
  markPersistedStorageMutation()
  const skill = (await ipc.invoke('spaces:ai-prototype:create-skill', {
    name: payload.name,
    tags: payload.tags,
    systemPrompt: payload.systemPrompt,
    defaults: payload.defaults,
    deliverableHints: payload.deliverableHints,
  })) as AiPrototypeSkill

  await refreshSkills()
  return skill
}

async function updateSkill(
  skillId: string,
  payload: {
    name: string
    tags?: string[]
    systemPrompt: string
    defaults?: AiPrototypeSkill['defaults']
    deliverableHints?: string[]
  },
) {
  markPersistedStorageMutation()
  const skill = (await ipc.invoke('spaces:ai-prototype:update-skill', {
    skillId,
    ...payload,
  })) as AiPrototypeSkill

  await refreshSkills()
  return skill
}

async function deleteSkill(skillId: string) {
  markPersistedStorageMutation()
  await ipc.invoke('spaces:ai-prototype:delete-skill', { skillId })
  await refreshSkills()

  if (activeSession.value?.skillId === skillId) {
    await updateSessionSkill(null)
  }
}

async function draftSkillFromSession(sessionId: string) {
  return (await ipc.invoke('spaces:ai-prototype:draft-skill-from-session', {
    sessionId,
  })) as { systemPrompt: string }
}

export function useAiPrototype() {
  ensureListener()

  return {
    sessions,
    totals,
    messages,
    deliverables,
    skills,
    activeSessionId,
    activeSession,
    activeSkill,
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
    refreshSkills,
    selectSession,
    createSession,
    deleteSession,
    updateSessionSkill,
    sendChat,
    generateImage,
    uploadAsset,
    getDeliverableContent,
    exportDeliverable,
    exportAllDeliverables,
    getAssetDataUrl,
    createSkill,
    updateSkill,
    deleteSkill,
    draftSkillFromSession,
  }
}
