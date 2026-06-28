export const AI_OPERATIONS_SPACE_ID = 'ai-operations'
export const AI_OPERATIONS_MODEL = 'gpt-image-2'
export const AI_OPERATIONS_DEFAULT_BASE_URL = 'https://grsai.dakka.com.cn'
export const AI_OPERATIONS_DEFAULT_ASPECT_RATIO = '768x1024'
export const AI_OPERATIONS_DEFAULT_POLL_INTERVAL_MS = 2500
export const AI_OPERATIONS_DEFAULT_CURSOR_MODEL = 'composer-2.5'
export const AI_OPERATIONS_POSTS_DIR = 'artifacts/posts'
export const AI_OPERATIONS_TEMPLATES_DIR = 'templates'

export type AiOperationsChatMode = 'write' | 'image'

export type AiOperationsMessageKind =
  | 'chat'
  | 'image-generation'
  | 'deliverable'

export type AiOperationsMessageStatus =
  | 'pending'
  | 'submitting'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'violation'

export interface AiOperationsSessionMeta {
  id: string
  title: string
  templateId?: string
  cursorAgentId?: string
  createdAt: number
  updatedAt: number
}

export interface AiOperationsSessionSummary extends AiOperationsSessionMeta {
  messageCount: number
  successCount: number
  failCount: number
  deliverableCount: number
}

export interface AiOperationsMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  kind?: AiOperationsMessageKind
  createdAt: number
  prompt?: string
  content?: string
  uploadAssetIds?: string[]
  remoteTaskId?: string
  status?: AiOperationsMessageStatus
  progress?: number
  error?: string
  model?: string
  aspectRatio?: string
  outputAssetIds?: string[]
  deliverableFileName?: string
  startedAt?: number
  finishedAt?: number
}

export interface AiOperationsIndexTotals {
  messages: number
  succeeded: number
  failed: number
  violations: number
}

export interface AiOperationsIndex {
  sessions: AiOperationsSessionSummary[]
  totals: AiOperationsIndexTotals
}

export interface AiOperationsTemplate {
  id: string
  name: string
  platform?: 'xiaohongshu' | 'wechat' | 'generic'
  tags?: string[]
  systemPrompt: string
  defaults?: {
    aspectRatio?: string
  }
  builtin?: boolean
}

export interface AiOperationsDeliverable {
  fileName: string
  updatedAt: number
}

export interface AiOperationsCreateSessionPayload {
  title?: string
  templateId?: string
}

export interface AiOperationsUpsertTemplatePayload {
  id?: string
  name: string
  platform?: AiOperationsTemplate['platform']
  tags?: string[]
  systemPrompt: string
  defaults?: AiOperationsTemplate['defaults']
}

export interface AiOperationsTemplateActionPayload {
  templateId: string
}

export interface AiOperationsSaveSessionAsTemplatePayload {
  sessionId: string
  name: string
  platform?: AiOperationsTemplate['platform']
  tags?: string[]
  systemPrompt?: string
  draftFromSession?: boolean
}

export interface AiOperationsSessionActionPayload {
  sessionId: string
}

export interface AiOperationsSendChatPayload {
  sessionId: string
  message: string
}

export interface AiOperationsSendChatResult {
  userMessage: AiOperationsMessage
  assistantMessage: AiOperationsMessage
}

export interface AiOperationsGenerateImagePayload {
  sessionId: string
  prompt: string
  uploadAssetIds?: string[]
  aspectRatio?: string
}

export interface AiOperationsGenerateImageResult {
  userMessage: AiOperationsMessage
  assistantMessage: AiOperationsMessage
}

export interface AiOperationsExportDeliverablePayload {
  sessionId: string
  fileName: string
  folderId: number | null
}

export interface AiOperationsExportDeliverableResult {
  noteId: number
  noteName: string
}

export interface AiOperationsExportDeliverablesPayload {
  sessionId: string
  folderId: number | null
}

export interface AiOperationsExportedDeliverableNote {
  noteId: number
  noteName: string
  fileName: string
}

export interface AiOperationsExportDeliverablesResult {
  notes: AiOperationsExportedDeliverableNote[]
}

export interface AiOperationsChatUpdatedPayload {
  sessionId: string
  message: AiOperationsMessage
}

export interface AiOperationsTaskUpdatedPayload {
  sessionId: string
  message: AiOperationsMessage
  totals: AiOperationsIndexTotals
}

export interface AiOperationsDeliverablesUpdatedPayload {
  sessionId: string
  deliverables: AiOperationsDeliverable[]
}

export function resolveAiOperationsMessageKind(
  message: Pick<AiOperationsMessage, 'kind' | 'role'>,
): AiOperationsMessageKind {
  if (message.kind) {
    return message.kind
  }

  return 'chat'
}
