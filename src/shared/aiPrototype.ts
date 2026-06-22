export const AI_PROTOTYPE_SPACE_ID = 'ai-prototype'
export const AI_PROTOTYPE_MODEL = 'gpt-image-2'
export const AI_PROTOTYPE_DEFAULT_BASE_URL = 'https://grsai.dakka.com.cn'
export const AI_PROTOTYPE_DEFAULT_ASPECT_RATIO = '1024x1024'
export const AI_PROTOTYPE_DEFAULT_POLL_INTERVAL_MS = 2500

export type AiPrototypeMessageStatus =
  | 'pending'
  | 'submitting'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'violation'

export interface AiPrototypeSessionMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface AiPrototypeSessionSummary extends AiPrototypeSessionMeta {
  messageCount: number
  successCount: number
  failCount: number
}

export interface AiPrototypeMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  createdAt: number
  prompt?: string
  uploadAssetIds?: string[]
  remoteTaskId?: string
  status?: AiPrototypeMessageStatus
  progress?: number
  error?: string
  model?: string
  aspectRatio?: string
  outputAssetIds?: string[]
  remoteResultUrls?: string[]
  startedAt?: number
  finishedAt?: number
}

export interface AiPrototypeIndexTotals {
  messages: number
  succeeded: number
  failed: number
  violations: number
}

export interface AiPrototypeIndex {
  sessions: AiPrototypeSessionSummary[]
  totals: AiPrototypeIndexTotals
}

export interface AiPrototypeSendMessagePayload {
  sessionId: string
  prompt: string
  aspectRatio?: string
  uploads?: Array<{
    name: string
    mimeType: string
    base64: string
  }>
}

export interface AiPrototypeSendMessageResult {
  userMessageId: string
  assistantMessageId: string
}

export interface AiPrototypeTaskUpdatedPayload {
  sessionId: string
  message: AiPrototypeMessage
  totals: AiPrototypeIndexTotals
}

export interface GrsaiGenerateResponse {
  id: string
  status: string
  progress?: number
  results?: Array<{ url: string }>
  error?: string
}
