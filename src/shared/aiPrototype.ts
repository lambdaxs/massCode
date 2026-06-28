export const AI_PROTOTYPE_SPACE_ID = 'ai-prototype'
export const AI_PROTOTYPE_MODEL = 'gpt-image-2'
export const AI_PROTOTYPE_DEFAULT_BASE_URL = 'https://grsai.dakka.com.cn'
export const AI_PROTOTYPE_DEFAULT_ASPECT_RATIO = '1024x1024'
export const AI_PROTOTYPE_DEFAULT_POLL_INTERVAL_MS = 2500
export const AI_PROTOTYPE_CREDITS_TOKEN = '1be60adec3b240bf91c7f3f75d60cd29'
export const AI_PROTOTYPE_DEFAULT_CURSOR_MODEL = 'composer-2.5'
export const AI_PROTOTYPE_ARTIFACTS_DIR = 'artifacts'
export const AI_PROTOTYPE_SKILLS_DIR = 'skills'

export const AI_PROTOTYPE_REQUIREMENTS_FILE = 'artifacts/requirements.md'
export const AI_PROTOTYPE_PRODUCT_DOC_FILE = 'artifacts/product-doc.md'

export type AiPrototypeChatMode = 'chat' | 'image'

export type AiPrototypeMessageKind =
  | 'chat'
  | 'image-generation'
  | 'deliverable'

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
  skillId?: string
  cursorAgentId?: string
  createdAt: number
  updatedAt: number
}

export interface AiPrototypeSessionSummary extends AiPrototypeSessionMeta {
  messageCount: number
  successCount: number
  failCount: number
  deliverableCount: number
}

export interface AiPrototypeMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  kind?: AiPrototypeMessageKind
  createdAt: number
  prompt?: string
  content?: string
  uploadAssetIds?: string[]
  remoteTaskId?: string
  status?: AiPrototypeMessageStatus
  progress?: number
  error?: string
  model?: string
  aspectRatio?: string
  outputAssetIds?: string[]
  deliverableId?: string
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

export interface AiPrototypeSkill {
  id: string
  name: string
  tags?: string[]
  systemPrompt: string
  defaults?: {
    aspectRatio?: string
  }
  deliverableHints?: string[]
  builtin?: boolean
}

export interface AiPrototypeDeliverable {
  id: string
  kind: 'markdown' | 'image'
  name: string
  updatedAt: number
}

export interface AiPrototypeCreateSessionPayload {
  title?: string
  skillId?: string
}

export interface AiPrototypeUpsertSkillPayload {
  id?: string
  name: string
  tags?: string[]
  systemPrompt: string
  defaults?: AiPrototypeSkill['defaults']
  deliverableHints?: string[]
}

export interface AiPrototypeSkillActionPayload {
  skillId: string
}

export interface AiPrototypeSessionActionPayload {
  sessionId: string
}

export interface AiPrototypeSendChatPayload {
  sessionId: string
  message: string
}

export interface AiPrototypeSendChatResult {
  userMessage: AiPrototypeMessage
  assistantMessage: AiPrototypeMessage
}

export interface AiPrototypeGenerateImagePayload {
  sessionId: string
  prompt: string
  uploadAssetIds?: string[]
  aspectRatio?: string
}

export interface AiPrototypeGenerateImageResult {
  userMessage: AiPrototypeMessage
  assistantMessage: AiPrototypeMessage
}

export interface AiPrototypeExportToNotesPayload {
  sessionId: string
  folderId: number | null
  deliverableId: string
}

export interface AiPrototypeExportToNotesResult {
  noteId: number
  noteName: string
}

export interface AiPrototypeExportDeliverablesPayload {
  sessionId: string
  folderId: number | null
}

export interface AiPrototypeExportedDeliverableNote {
  noteId: number
  noteName: string
  deliverableId: string
}

export interface AiPrototypeExportDeliverablesResult {
  notes: AiPrototypeExportedDeliverableNote[]
}

export interface AiPrototypeChatUpdatedPayload {
  sessionId: string
  message: AiPrototypeMessage
}

export interface AiPrototypeDeliverablesUpdatedPayload {
  sessionId: string
  deliverables: AiPrototypeDeliverable[]
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

export function resolveAiPrototypeMessageKind(
  message: AiPrototypeMessage,
): AiPrototypeMessageKind {
  if (message.kind) {
    return message.kind
  }

  if (message.role === 'assistant' && message.status) {
    return 'image-generation'
  }

  if (message.role === 'assistant' && message.deliverableId) {
    return 'deliverable'
  }

  return 'chat'
}
