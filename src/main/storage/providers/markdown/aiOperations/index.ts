import type {
  AiOperationsDeliverable,
  AiOperationsIndex,
  AiOperationsIndexTotals,
  AiOperationsMessage,
  AiOperationsSessionMeta,
  AiOperationsSessionSummary,
  AiOperationsTemplate,
} from '../../../../../shared/aiOperations'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { request as undiciRequest } from 'undici'
import {
  AI_OPERATIONS_POSTS_DIR,
  AI_OPERATIONS_SPACE_ID,
  AI_OPERATIONS_TEMPLATES_DIR,
} from '../../../../../shared/aiOperations'
import {
  BUILTIN_AI_OPERATIONS_TEMPLATES,
  getBuiltinAiOperationsTemplate,
} from '../../../../aiOperations/templates'
import { ensureSpaceDirectory, getSpaceDirPath } from '../runtime/spaces'

const INDEX_FILE = 'index.json'
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function getRootDir(vaultPath: string): string {
  return ensureSpaceDirectory(vaultPath, AI_OPERATIONS_SPACE_ID)
}

function getIndexPath(vaultPath: string): string {
  return path.join(getRootDir(vaultPath), INDEX_FILE)
}

function getSessionDir(vaultPath: string, sessionId: string): string {
  const sessionDir = path.join(getRootDir(vaultPath), 'sessions', sessionId)
  if (path.dirname(sessionDir) === sessionId || !sessionId.trim()) {
    throw new Error('INVALID_SESSION_ID')
  }
  return sessionDir
}

function getMessagesDir(vaultPath: string, sessionId: string): string {
  return path.join(getSessionDir(vaultPath, sessionId), 'messages')
}

function getPostsDir(vaultPath: string, sessionId: string): string {
  return path.join(
    getSessionDir(vaultPath, sessionId),
    AI_OPERATIONS_POSTS_DIR,
  )
}

function getUploadsDir(vaultPath: string, sessionId: string): string {
  return path.join(getSessionDir(vaultPath, sessionId), 'assets', 'uploads')
}

function getOutputsDir(vaultPath: string, sessionId: string): string {
  return path.join(getSessionDir(vaultPath, sessionId), 'assets', 'outputs')
}

function getTemplatesDir(vaultPath: string): string {
  return path.join(getRootDir(vaultPath), AI_OPERATIONS_TEMPLATES_DIR)
}

export function getAiOperationsSessionWorkspace(
  vaultPath: string,
  sessionId: string,
): string {
  return getSessionDir(vaultPath, sessionId)
}

function ensureSessionDirs(vaultPath: string, sessionId: string): void {
  fs.ensureDirSync(getMessagesDir(vaultPath, sessionId))
  fs.ensureDirSync(getPostsDir(vaultPath, sessionId))
  fs.ensureDirSync(getUploadsDir(vaultPath, sessionId))
  fs.ensureDirSync(getOutputsDir(vaultPath, sessionId))
}

function emptyTotals(): AiOperationsIndexTotals {
  return {
    messages: 0,
    succeeded: 0,
    failed: 0,
    violations: 0,
  }
}

function emptyIndex(): AiOperationsIndex {
  return {
    sessions: [],
    totals: emptyTotals(),
  }
}

function readIndex(vaultPath: string): AiOperationsIndex {
  const indexPath = getIndexPath(vaultPath)
  if (!fs.pathExistsSync(indexPath)) {
    return emptyIndex()
  }

  try {
    const parsed = fs.readJsonSync(indexPath) as AiOperationsIndex
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      totals: parsed.totals ?? emptyTotals(),
    }
  }
  catch {
    return emptyIndex()
  }
}

function writeIndex(vaultPath: string, index: AiOperationsIndex): void {
  fs.ensureDirSync(getRootDir(vaultPath))
  fs.writeJsonSync(getIndexPath(vaultPath), index, { spaces: 2 })
}

function readSessionMeta(
  vaultPath: string,
  sessionId: string,
): AiOperationsSessionMeta | null {
  const metaPath = path.join(getSessionDir(vaultPath, sessionId), 'meta.json')
  if (!fs.pathExistsSync(metaPath)) {
    return null
  }

  try {
    return fs.readJsonSync(metaPath) as AiOperationsSessionMeta
  }
  catch {
    return null
  }
}

function writeSessionMeta(
  vaultPath: string,
  meta: AiOperationsSessionMeta,
): void {
  const sessionDir = getSessionDir(vaultPath, meta.id)
  fs.ensureDirSync(sessionDir)
  fs.writeJsonSync(path.join(sessionDir, 'meta.json'), meta, { spaces: 2 })
}

function messagePath(vaultPath: string, sessionId: string, messageId: string) {
  return path.join(getMessagesDir(vaultPath, sessionId), `${messageId}.json`)
}

function readMessage(
  vaultPath: string,
  sessionId: string,
  messageId: string,
): AiOperationsMessage | null {
  const filePath = messagePath(vaultPath, sessionId, messageId)
  if (!fs.pathExistsSync(filePath)) {
    return null
  }

  try {
    return fs.readJsonSync(filePath) as AiOperationsMessage
  }
  catch {
    return null
  }
}

function writeMessage(vaultPath: string, message: AiOperationsMessage): void {
  fs.ensureDirSync(getMessagesDir(vaultPath, message.sessionId))
  fs.writeJsonSync(
    messagePath(vaultPath, message.sessionId, message.id),
    message,
    { spaces: 2 },
  )
}

function truncateTitle(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) {
    return 'Untitled'
  }

  return Array.from(trimmed).slice(0, 40).join('')
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') {
    return '.png'
  }
  if (mimeType === 'image/webp') {
    return '.webp'
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return '.jpg'
  }
  return '.png'
}

function countDeliverables(vaultPath: string, sessionId: string): number {
  const postsDir = getPostsDir(vaultPath, sessionId)
  if (!fs.pathExistsSync(postsDir)) {
    return 0
  }

  return fs
    .readdirSync(postsDir)
    .filter(name => name.endsWith('.md') && !name.startsWith('.'))
    .length
}

function recountSession(vaultPath: string, sessionId: string) {
  const messagesDir = getMessagesDir(vaultPath, sessionId)
  if (!fs.pathExistsSync(messagesDir)) {
    return {
      messageCount: 0,
      successCount: 0,
      failCount: 0,
    }
  }

  let messageCount = 0
  let successCount = 0
  let failCount = 0

  for (const fileName of fs.readdirSync(messagesDir)) {
    if (!fileName.endsWith('.json')) {
      continue
    }

    const message = fs.readJsonSync(
      path.join(messagesDir, fileName),
    ) as AiOperationsMessage
    if (message.role !== 'assistant') {
      continue
    }

    messageCount += 1
    if (message.status === 'succeeded') {
      successCount += 1
    }
    if (message.status === 'failed') {
      failCount += 1
    }
  }

  return { messageCount, successCount, failCount }
}

function syncSessionSummary(vaultPath: string, sessionId: string) {
  const meta = readSessionMeta(vaultPath, sessionId)
  if (!meta) {
    return
  }

  const counts = recountSession(vaultPath, sessionId)
  const summary: AiOperationsSessionSummary = {
    ...meta,
    ...counts,
    deliverableCount: countDeliverables(vaultPath, sessionId),
  }

  const index = readIndex(vaultPath)
  const existingIndex = index.sessions.findIndex(
    item => item.id === sessionId,
  )
  if (existingIndex >= 0) {
    index.sessions[existingIndex] = summary
  }
  else {
    index.sessions.unshift(summary)
  }

  index.sessions.sort((a, b) => b.updatedAt - a.updatedAt)
  writeIndex(vaultPath, index)
}

function recomputeTotals(vaultPath: string): AiOperationsIndexTotals {
  const index = readIndex(vaultPath)
  const totals = emptyTotals()

  for (const session of index.sessions) {
    totals.messages += session.messageCount
    totals.succeeded += session.successCount
    totals.failed += session.failCount
  }

  const sessionsRoot = path.join(getRootDir(vaultPath), 'sessions')
  if (fs.pathExistsSync(sessionsRoot)) {
    for (const sessionId of fs.readdirSync(sessionsRoot)) {
      const messagesDir = getMessagesDir(vaultPath, sessionId)
      if (!fs.pathExistsSync(messagesDir)) {
        continue
      }
      for (const fileName of fs.readdirSync(messagesDir)) {
        if (!fileName.endsWith('.json')) {
          continue
        }
        const message = fs.readJsonSync(
          path.join(messagesDir, fileName),
        ) as AiOperationsMessage
        if (message.role === 'assistant' && message.status === 'violation') {
          totals.violations += 1
        }
      }
    }
  }

  index.totals = totals
  writeIndex(vaultPath, index)
  return totals
}

function parseVaultTemplate(filePath: string): AiOperationsTemplate | null {
  try {
    const parsed = yaml.load(fs.readFileSync(filePath, 'utf8')) as Record<
      string,
      unknown
    >
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const id = String(
      parsed.id ?? path.basename(filePath, path.extname(filePath)),
    )
    const name = String(parsed.name ?? id)
    const systemPrompt = String(parsed.systemPrompt ?? '').trim()
    if (!systemPrompt) {
      return null
    }

    const platform = parsed.platform
    const defaults = parsed.defaults as AiOperationsTemplate['defaults']

    return {
      id,
      name,
      systemPrompt,
      platform:
        platform === 'xiaohongshu'
        || platform === 'wechat'
        || platform === 'generic'
          ? platform
          : undefined,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map(item => String(item))
        : undefined,
      defaults,
      builtin: false,
    }
  }
  catch {
    return null
  }
}

export function listAiOperationsSessions(vaultPath: string): AiOperationsIndex {
  return readIndex(vaultPath)
}

export function getAiOperationsTotals(
  vaultPath: string,
): AiOperationsIndexTotals {
  return readIndex(vaultPath).totals
}

export function readAiOperationsSessionMeta(
  vaultPath: string,
  sessionId: string,
): AiOperationsSessionMeta | null {
  return readSessionMeta(vaultPath, sessionId)
}

export function updateAiOperationsSessionMeta(
  vaultPath: string,
  sessionId: string,
  patch: Partial<AiOperationsSessionMeta>,
): AiOperationsSessionMeta | null {
  const meta = readSessionMeta(vaultPath, sessionId)
  if (!meta) {
    return null
  }

  const nextMeta: AiOperationsSessionMeta = {
    ...meta,
    ...patch,
    updatedAt: Date.now(),
  }
  writeSessionMeta(vaultPath, nextMeta)
  syncSessionSummary(vaultPath, sessionId)
  return nextMeta
}

export function createAiOperationsSession(
  vaultPath: string,
  payload?: { title?: string, templateId?: string },
): AiOperationsSessionSummary {
  const now = Date.now()
  const id = randomUUID()
  const meta: AiOperationsSessionMeta = {
    id,
    title: payload?.title?.trim() || 'Untitled',
    templateId: payload?.templateId?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }

  writeSessionMeta(vaultPath, meta)
  ensureSessionDirs(vaultPath, id)

  const summary: AiOperationsSessionSummary = {
    ...meta,
    messageCount: 0,
    successCount: 0,
    failCount: 0,
    deliverableCount: 0,
  }

  const index = readIndex(vaultPath)
  index.sessions.unshift(summary)
  writeIndex(vaultPath, index)

  return summary
}

export function deleteAiOperationsSession(
  vaultPath: string,
  sessionId: string,
): boolean {
  const sessionDir = getSessionDir(vaultPath, sessionId)
  if (!fs.pathExistsSync(sessionDir)) {
    return false
  }

  fs.removeSync(sessionDir)
  const index = readIndex(vaultPath)
  index.sessions = index.sessions.filter(item => item.id !== sessionId)
  writeIndex(vaultPath, index)
  recomputeTotals(vaultPath)
  return true
}

export function listAiOperationsMessages(
  vaultPath: string,
  sessionId: string,
): AiOperationsMessage[] {
  const messagesDir = getMessagesDir(vaultPath, sessionId)
  if (!fs.pathExistsSync(messagesDir)) {
    return []
  }

  return fs
    .readdirSync(messagesDir)
    .filter(name => name.endsWith('.json'))
    .map(
      name =>
        fs.readJsonSync(path.join(messagesDir, name)) as AiOperationsMessage,
    )
    .sort((a, b) => a.createdAt - b.createdAt)
}

export function listAiOperationsDeliverables(
  vaultPath: string,
  sessionId: string,
): AiOperationsDeliverable[] {
  const postsDir = getPostsDir(vaultPath, sessionId)
  if (!fs.pathExistsSync(postsDir)) {
    return []
  }

  return fs
    .readdirSync(postsDir)
    .filter(name => name.endsWith('.md') && !name.startsWith('.'))
    .map((fileName) => {
      const stat = fs.statSync(path.join(postsDir, fileName))
      return {
        fileName,
        updatedAt: stat.mtimeMs,
      }
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function listDeliverableFileNames(
  vaultPath: string,
  sessionId: string,
): string[] {
  return listAiOperationsDeliverables(vaultPath, sessionId).map(
    item => item.fileName,
  )
}

export function readAiOperationsDeliverable(
  vaultPath: string,
  sessionId: string,
  fileName: string,
): string | null {
  const safeName = path.basename(fileName)
  const filePath = path.join(getPostsDir(vaultPath, sessionId), safeName)
  if (!fs.pathExistsSync(filePath)) {
    return null
  }

  const content = fs.readFileSync(filePath, 'utf8').trim()
  return content || null
}

export function listAiOperationsTemplates(
  vaultPath: string,
): AiOperationsTemplate[] {
  const templates = [...BUILTIN_AI_OPERATIONS_TEMPLATES]
  const templatesDir = getTemplatesDir(vaultPath)

  if (fs.pathExistsSync(templatesDir)) {
    for (const fileName of fs.readdirSync(templatesDir)) {
      if (!fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) {
        continue
      }

      const parsed = parseVaultTemplate(path.join(templatesDir, fileName))
      if (!parsed) {
        continue
      }

      const existingIndex = templates.findIndex(
        item => item.id === parsed.id,
      )
      if (existingIndex >= 0) {
        templates[existingIndex] = parsed
      }
      else {
        templates.push(parsed)
      }
    }
  }

  return templates
}

export function getAiOperationsTemplate(
  vaultPath: string,
  templateId: string,
): AiOperationsTemplate | null {
  const builtin = getBuiltinAiOperationsTemplate(templateId)
  if (builtin) {
    return builtin
  }

  const templatesDir = getTemplatesDir(vaultPath)
  if (!fs.pathExistsSync(templatesDir)) {
    return null
  }

  for (const fileName of fs.readdirSync(templatesDir)) {
    if (!fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) {
      continue
    }

    const parsed = parseVaultTemplate(path.join(templatesDir, fileName))
    if (parsed?.id === templateId) {
      return parsed
    }
  }

  return null
}

export function resolveSessionTemplate(
  vaultPath: string,
  session: AiOperationsSessionMeta,
): AiOperationsTemplate | null {
  if (!session.templateId?.trim()) {
    return null
  }

  return getAiOperationsTemplate(vaultPath, session.templateId)
}

function slugifyTemplateId(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4E00-\u9FFF-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return normalized || 'template'
}

function templateIdExists(vaultPath: string, id: string): boolean {
  if (getBuiltinAiOperationsTemplate(id)) {
    return true
  }

  return fs.pathExistsSync(getVaultTemplateFilePath(vaultPath, id))
}

function resolveUniqueTemplateId(vaultPath: string, baseId: string): string {
  let candidate = baseId
  let suffix = 1

  while (templateIdExists(vaultPath, candidate)) {
    candidate = `${baseId}-${suffix}`
    suffix += 1
  }

  return candidate
}

function getVaultTemplateFilePath(
  vaultPath: string,
  templateId: string,
): string {
  return path.join(getTemplatesDir(vaultPath), `${templateId}.yaml`)
}

function serializeVaultTemplate(template: AiOperationsTemplate): string {
  const doc: Record<string, unknown> = {
    id: template.id,
    name: template.name,
    systemPrompt: template.systemPrompt,
  }

  if (template.platform) {
    doc.platform = template.platform
  }

  if (template.tags?.length) {
    doc.tags = template.tags
  }

  if (template.defaults?.aspectRatio) {
    doc.defaults = { aspectRatio: template.defaults.aspectRatio }
  }

  return yaml.dump(doc, { lineWidth: 120, noRefs: true })
}

function writeVaultTemplate(
  vaultPath: string,
  template: AiOperationsTemplate,
): AiOperationsTemplate {
  if (getBuiltinAiOperationsTemplate(template.id)) {
    throw new Error('TEMPLATE_BUILTIN_READONLY')
  }

  fs.ensureDirSync(getTemplatesDir(vaultPath))
  fs.writeFileSync(
    getVaultTemplateFilePath(vaultPath, template.id),
    serializeVaultTemplate({ ...template, builtin: false }),
    'utf8',
  )

  return { ...template, builtin: false }
}

export function createAiOperationsTemplate(
  vaultPath: string,
  payload: {
    id?: string
    name: string
    platform?: AiOperationsTemplate['platform']
    tags?: string[]
    systemPrompt: string
    defaults?: AiOperationsTemplate['defaults']
  },
): AiOperationsTemplate {
  const name = payload.name.trim()
  const systemPrompt = payload.systemPrompt.trim()

  if (!name) {
    throw new Error('TEMPLATE_NAME_MISSING')
  }

  if (!systemPrompt) {
    throw new Error('TEMPLATE_PROMPT_MISSING')
  }

  const baseId = payload.id?.trim() || slugifyTemplateId(name)
  const id = resolveUniqueTemplateId(vaultPath, baseId)

  return writeVaultTemplate(vaultPath, {
    id,
    name,
    platform: payload.platform,
    tags: payload.tags?.filter(Boolean),
    systemPrompt,
    defaults: payload.defaults,
    builtin: false,
  })
}

export function updateAiOperationsTemplate(
  vaultPath: string,
  templateId: string,
  payload: {
    name?: string
    platform?: AiOperationsTemplate['platform'] | null
    tags?: string[]
    systemPrompt?: string
    defaults?: AiOperationsTemplate['defaults'] | null
  },
): AiOperationsTemplate {
  const existing = getAiOperationsTemplate(vaultPath, templateId)
  if (!existing) {
    throw new Error('TEMPLATE_NOT_FOUND')
  }

  if (existing.builtin) {
    throw new Error('TEMPLATE_BUILTIN_READONLY')
  }

  const name = payload.name?.trim() || existing.name
  const systemPrompt = payload.systemPrompt?.trim() || existing.systemPrompt

  if (!name) {
    throw new Error('TEMPLATE_NAME_MISSING')
  }

  if (!systemPrompt) {
    throw new Error('TEMPLATE_PROMPT_MISSING')
  }

  const updated = writeVaultTemplate(vaultPath, {
    id: templateId,
    name,
    platform:
      payload.platform === null
        ? undefined
        : (payload.platform ?? existing.platform),
    tags: payload.tags ?? existing.tags,
    systemPrompt,
    defaults:
      payload.defaults === null
        ? undefined
        : (payload.defaults ?? existing.defaults),
    builtin: false,
  })

  return updated
}

export function deleteAiOperationsTemplate(
  vaultPath: string,
  templateId: string,
): boolean {
  const existing = getAiOperationsTemplate(vaultPath, templateId)
  if (!existing) {
    return false
  }

  if (existing.builtin) {
    throw new Error('TEMPLATE_BUILTIN_READONLY')
  }

  const filePath = getVaultTemplateFilePath(vaultPath, templateId)
  if (!fs.pathExistsSync(filePath)) {
    return false
  }

  fs.removeSync(filePath)
  return true
}

export function formatSessionMessagesForTemplateDraft(
  messages: AiOperationsMessage[],
): string {
  return messages
    .filter(message => message.kind === 'chat' || !message.kind)
    .map((message) => {
      if (message.role === 'user') {
        return `User: ${message.prompt?.trim() ?? ''}`
      }

      return `Assistant: ${message.content?.trim() ?? ''}`
    })
    .filter(line => line.trim().length > 8)
    .slice(-24)
    .join('\n\n')
}

export function saveUploadAsset(
  vaultPath: string,
  sessionId: string,
  payload: { name: string, mimeType: string, base64: string },
): string {
  const buffer = Buffer.from(payload.base64, 'base64')
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('UPLOAD_TOO_LARGE')
  }

  const assetId = `${randomUUID()}${extensionForMime(payload.mimeType)}`
  fs.ensureDirSync(getUploadsDir(vaultPath, sessionId))
  fs.writeFileSync(
    path.join(getUploadsDir(vaultPath, sessionId), assetId),
    buffer,
  )
  return assetId
}

export function readAiOperationsAssetBase64(
  vaultPath: string,
  sessionId: string,
  assetId: string,
  kind: 'uploads' | 'outputs',
): { mimeType: string, dataUrl: string } | null {
  const baseDir
    = kind === 'uploads'
      ? getUploadsDir(vaultPath, sessionId)
      : getOutputsDir(vaultPath, sessionId)
  const filePath = path.join(baseDir, path.basename(assetId))
  if (!fs.pathExistsSync(filePath)) {
    return null
  }

  const ext = path.extname(filePath).toLowerCase()
  const mimeType
    = ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : 'image/jpeg'
  const base64 = fs.readFileSync(filePath).toString('base64')
  return {
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64}`,
  }
}

export async function downloadOutputAsset(
  vaultPath: string,
  sessionId: string,
  remoteUrl: string,
): Promise<string> {
  const response = await undiciRequest(remoteUrl)
  if (response.statusCode >= 400) {
    throw new Error(`DOWNLOAD_FAILED:${response.statusCode}`)
  }

  const buffer = Buffer.from(await response.body.arrayBuffer())
  const contentType = String(response.headers['content-type'] ?? 'image/png')
  const ext = extensionForMime(
    contentType.split(';')[0]?.trim() ?? 'image/png',
  )
  const assetId = `${randomUUID()}${ext}`

  fs.ensureDirSync(getOutputsDir(vaultPath, sessionId))
  fs.writeFileSync(
    path.join(getOutputsDir(vaultPath, sessionId), assetId),
    buffer,
  )
  return assetId
}

export function getUploadBase64List(
  vaultPath: string,
  sessionId: string,
  assetIds: string[],
): string[] {
  return assetIds.map((assetId) => {
    const filePath = path.join(
      getUploadsDir(vaultPath, sessionId),
      path.basename(assetId),
    )
    return fs.readFileSync(filePath).toString('base64')
  })
}

export function createAiOperationsChatPair(
  vaultPath: string,
  sessionId: string,
  payload: {
    userText: string
    assistantStatus?: AiOperationsMessage['status']
  },
): { userMessage: AiOperationsMessage, assistantMessage: AiOperationsMessage } {
  const now = Date.now()
  const userMessage: AiOperationsMessage = {
    id: randomUUID(),
    sessionId,
    role: 'user',
    kind: 'chat',
    createdAt: now,
    prompt: payload.userText,
  }

  const assistantMessage: AiOperationsMessage = {
    id: randomUUID(),
    sessionId,
    role: 'assistant',
    kind: 'chat',
    createdAt: now + 1,
    status: payload.assistantStatus,
    startedAt: payload.assistantStatus === 'running' ? Date.now() : undefined,
  }

  writeMessage(vaultPath, userMessage)
  writeMessage(vaultPath, assistantMessage)

  const meta = readSessionMeta(vaultPath, sessionId)
  if (meta) {
    if (meta.title === 'Untitled' && payload.userText.trim()) {
      meta.title = truncateTitle(payload.userText)
    }
    meta.updatedAt = now
    writeSessionMeta(vaultPath, meta)
  }

  syncSessionSummary(vaultPath, sessionId)
  return { userMessage, assistantMessage }
}

export function createAiOperationsDeliverableMessage(
  vaultPath: string,
  sessionId: string,
  fileName: string,
): AiOperationsMessage {
  const message: AiOperationsMessage = {
    id: randomUUID(),
    sessionId,
    role: 'assistant',
    kind: 'deliverable',
    createdAt: Date.now(),
    status: 'succeeded',
    deliverableFileName: fileName,
    content: fileName,
    finishedAt: Date.now(),
  }

  writeMessage(vaultPath, message)
  syncSessionSummary(vaultPath, sessionId)
  return message
}

export function createAiOperationsImagePair(
  vaultPath: string,
  sessionId: string,
  payload: {
    prompt: string
    uploadAssetIds: string[]
    aspectRatio: string
    model: string
  },
): { userMessage: AiOperationsMessage, assistantMessage: AiOperationsMessage } {
  const now = Date.now()
  const userMessage: AiOperationsMessage = {
    id: randomUUID(),
    sessionId,
    role: 'user',
    kind: 'image-generation',
    createdAt: now,
    prompt: payload.prompt,
    uploadAssetIds: payload.uploadAssetIds,
  }

  const assistantMessage: AiOperationsMessage = {
    id: randomUUID(),
    sessionId,
    role: 'assistant',
    kind: 'image-generation',
    createdAt: now + 1,
    status: 'pending',
    model: payload.model,
    aspectRatio: payload.aspectRatio,
    progress: 0,
  }

  writeMessage(vaultPath, userMessage)
  writeMessage(vaultPath, assistantMessage)

  const meta = readSessionMeta(vaultPath, sessionId)
  if (meta) {
    if (meta.title === 'Untitled' && payload.prompt.trim()) {
      meta.title = truncateTitle(payload.prompt)
    }
    meta.updatedAt = now
    writeSessionMeta(vaultPath, meta)
  }

  syncSessionSummary(vaultPath, sessionId)
  return { userMessage, assistantMessage }
}

export function updateAiOperationsMessage(
  vaultPath: string,
  message: AiOperationsMessage,
): void {
  writeMessage(vaultPath, message)

  const meta = readSessionMeta(vaultPath, message.sessionId)
  if (meta) {
    meta.updatedAt = Date.now()
    writeSessionMeta(vaultPath, meta)
  }

  syncSessionSummary(vaultPath, message.sessionId)
  recomputeTotals(vaultPath)
}

export function getAiOperationsMessage(
  vaultPath: string,
  sessionId: string,
  messageId: string,
): AiOperationsMessage | null {
  return readMessage(vaultPath, sessionId, messageId)
}

export function getAiOperationsSpaceDir(vaultPath: string): string {
  return getSpaceDirPath(vaultPath, AI_OPERATIONS_SPACE_ID)
}
