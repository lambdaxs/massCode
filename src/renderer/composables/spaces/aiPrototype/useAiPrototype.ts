import type {
  AiPrototypeIndex,
  AiPrototypeIndexTotals,
  AiPrototypeMessage,
  AiPrototypeSendMessagePayload,
  AiPrototypeSessionSummary,
  AiPrototypeTaskUpdatedPayload,
} from '~/shared/aiPrototype'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { ipc, store } from '@/electron'

const sessions = ref<AiPrototypeSessionSummary[]>([])
const totals = ref<AiPrototypeIndexTotals>({
  messages: 0,
  succeeded: 0,
  failed: 0,
  violations: 0,
})
const messages = ref<AiPrototypeMessage[]>([])
const activeSessionId = ref<string | null>(
  store.app.get<string>('aiPrototype.activeSessionId') ?? null,
)
const isSending = ref(false)
const assetCache = new Map<string, string>()
let initialized = false

const activeSession = computed(() => {
  return (
    sessions.value.find(item => item.id === activeSessionId.value) ?? null
  )
})

const isGenerating = computed(() => {
  return messages.value.some((message) => {
    return (
      message.role === 'assistant'
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

function upsertSessionSummary(summary: AiPrototypeSessionSummary) {
  const index = sessions.value.findIndex(item => item.id === summary.id)
  if (index >= 0) {
    sessions.value[index] = summary
  }
  else {
    sessions.value.unshift(summary)
  }
  sessions.value.sort((a, b) => b.updatedAt - a.updatedAt)
}

function ensureListener() {
  if (initialized) {
    return
  }

  ipc.on(
    'spaces:ai-prototype:task-updated',
    (_, payload: AiPrototypeTaskUpdatedPayload) => {
      if (payload.sessionId !== activeSessionId.value) {
        const session = sessions.value.find(
          item => item.id === payload.sessionId,
        )
        if (session) {
          upsertSessionSummary({
            ...session,
            updatedAt: payload.message.finishedAt ?? session.updatedAt,
          })
        }
        totals.value = payload.totals
        return
      }

      upsertMessage(payload.message)
      totals.value = payload.totals
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

async function refreshMessages(sessionId: string) {
  const items = (await ipc.invoke('spaces:ai-prototype:get-messages', {
    sessionId,
  })) as AiPrototypeMessage[]
  messages.value = Array.isArray(items) ? items : []
}

async function init() {
  ensureListener()
  await refreshSessions()

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
    await refreshMessages(activeSessionId.value)
  }
}

async function selectSession(sessionId: string) {
  activeSessionId.value = sessionId
  persistActiveSession()
  await refreshMessages(sessionId)
}

async function createSession() {
  markPersistedStorageMutation()
  const session = (await ipc.invoke(
    'spaces:ai-prototype:create-session',
    null,
  )) as AiPrototypeSessionSummary | null
  if (!session) {
    return null
  }

  upsertSessionSummary(session)
  await selectSession(session.id)
  return session
}

async function deleteSession(sessionId: string) {
  markPersistedStorageMutation()
  await ipc.invoke('spaces:ai-prototype:delete-session', { sessionId })
  sessions.value = sessions.value.filter(item => item.id !== sessionId)

  if (activeSessionId.value === sessionId) {
    activeSessionId.value = sessions.value[0]?.id ?? null
    persistActiveSession()
    messages.value = []
    if (activeSessionId.value) {
      await refreshMessages(activeSessionId.value)
    }
  }

  await refreshSessions()
}

async function sendMessage(
  payload: Omit<AiPrototypeSendMessagePayload, 'sessionId'>,
) {
  if (!activeSessionId.value || isSending.value || isGenerating.value) {
    return
  }

  isSending.value = true

  try {
    markPersistedStorageMutation()
    await ipc.invoke('spaces:ai-prototype:send-message', {
      sessionId: activeSessionId.value,
      ...payload,
    })
    await refreshMessages(activeSessionId.value)
    await refreshSessions()
  }
  finally {
    isSending.value = false
  }
}

async function getAssetDataUrl(
  sessionId: string,
  assetId: string,
  kind: 'uploads' | 'outputs',
): Promise<string | null> {
  const cacheKey = `${sessionId}:${kind}:${assetId}`
  const cached = assetCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const result = (await ipc.invoke('spaces:ai-prototype:get-asset', {
    sessionId,
    assetId,
    kind,
  })) as { dataUrl: string } | null

  if (!result?.dataUrl) {
    return null
  }

  assetCache.set(cacheKey, result.dataUrl)
  return result.dataUrl
}

export function useAiPrototype() {
  ensureListener()

  return {
    sessions,
    totals,
    messages,
    activeSessionId,
    activeSession,
    isSending,
    isGenerating,
    init,
    refreshSessions,
    refreshMessages,
    selectSession,
    createSession,
    deleteSession,
    sendMessage,
    getAssetDataUrl,
  }
}
