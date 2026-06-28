import type {
  AiPrototypeDeliverable,
  AiPrototypeIndex,
  AiPrototypeIndexTotals,
  AiPrototypeMessage,
  AiPrototypeSessionMeta,
  AiPrototypeSessionSummary,
  AiPrototypeSkill,
} from '../../../../../shared/aiPrototype'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { request as undiciRequest } from 'undici'
import {
  AI_PROTOTYPE_PRODUCT_DOC_FILE,
  AI_PROTOTYPE_REQUIREMENTS_FILE,
  AI_PROTOTYPE_SKILLS_DIR,
  AI_PROTOTYPE_SPACE_ID,
} from '../../../../../shared/aiPrototype'
import {
  BUILTIN_AI_PROTOTYPE_SKILLS,
  getBuiltinAiPrototypeSkill,
} from '../../../../aiPrototype/skills'
import { ensureSpaceDirectory, getSpaceDirPath } from '../runtime/spaces'

const INDEX_FILE = 'index.json'
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function getRootDir(vaultPath: string): string {
  return ensureSpaceDirectory(vaultPath, AI_PROTOTYPE_SPACE_ID)
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

function getUploadsDir(vaultPath: string, sessionId: string): string {
  return path.join(getSessionDir(vaultPath, sessionId), 'assets', 'uploads')
}

function getArtifactsDir(vaultPath: string, sessionId: string): string {
  return path.join(getSessionDir(vaultPath, sessionId), 'artifacts')
}

function getArtifactPath(
  vaultPath: string,
  sessionId: string,
  relativePath: string,
): string {
  return path.join(getSessionDir(vaultPath, sessionId), relativePath)
}

function normalizeSessionMeta(
  meta: AiPrototypeSessionMeta,
): AiPrototypeSessionMeta {
  return { ...meta }
}

export function getAiPrototypeSessionWorkspace(
  vaultPath: string,
  sessionId: string,
): string {
  return getSessionDir(vaultPath, sessionId)
}

export function ensureAiPrototypeSessionArtifacts(
  vaultPath: string,
  sessionId: string,
): void {
  fs.ensureDirSync(getArtifactsDir(vaultPath, sessionId))
}

export function readAiPrototypeSessionMeta(
  vaultPath: string,
  sessionId: string,
): AiPrototypeSessionMeta | null {
  const meta = readSessionMeta(vaultPath, sessionId)
  if (!meta) {
    return null
  }

  return normalizeSessionMeta(meta)
}

export function updateAiPrototypeSessionMeta(
  vaultPath: string,
  sessionId: string,
  patch: Partial<AiPrototypeSessionMeta>,
): AiPrototypeSessionMeta | null {
  const meta = readSessionMeta(vaultPath, sessionId)
  if (!meta) {
    return null
  }

  const nextMeta = normalizeSessionMeta({
    ...meta,
    ...patch,
    updatedAt: Date.now(),
  })
  writeSessionMeta(vaultPath, nextMeta)
  syncSessionSummary(vaultPath, sessionId)
  return nextMeta
}

export function readAiPrototypeRequirements(
  vaultPath: string,
  sessionId: string,
): string | null {
  const filePath = getArtifactPath(
    vaultPath,
    sessionId,
    AI_PROTOTYPE_REQUIREMENTS_FILE,
  )
  if (!fs.pathExistsSync(filePath)) {
    return null
  }

  const content = fs.readFileSync(filePath, 'utf8').trim()
  return content || null
}

export function readAiPrototypeProductDoc(
  vaultPath: string,
  sessionId: string,
): string | null {
  const filePath = getArtifactPath(
    vaultPath,
    sessionId,
    AI_PROTOTYPE_PRODUCT_DOC_FILE,
  )
  if (!fs.pathExistsSync(filePath)) {
    return null
  }

  const content = fs.readFileSync(filePath, 'utf8').trim()
  return content || null
}

export function readAiPrototypeArtifacts(
  vaultPath: string,
  sessionId: string,
): { requirements: string | null, productDoc: string | null } {
  return {
    requirements: readAiPrototypeRequirements(vaultPath, sessionId),
    productDoc: readAiPrototypeProductDoc(vaultPath, sessionId),
  }
}

export function listAiPrototypeOutputAssets(
  vaultPath: string,
  sessionId: string,
): string[] {
  const outputsDir = getOutputsDir(vaultPath, sessionId)
  if (!fs.pathExistsSync(outputsDir)) {
    return []
  }

  return fs
    .readdirSync(outputsDir)
    .filter(fileName => !fileName.startsWith('.'))
    .sort((left, right) => left.localeCompare(right))
}

export function getAiPrototypeOutputAssetPath(
  vaultPath: string,
  sessionId: string,
  assetId: string,
): string {
  return path.join(getOutputsDir(vaultPath, sessionId), path.basename(assetId))
}

function getOutputsDir(vaultPath: string, sessionId: string): string {
  return path.join(getSessionDir(vaultPath, sessionId), 'assets', 'outputs')
}

function emptyTotals(): AiPrototypeIndexTotals {
  return {
    messages: 0,
    succeeded: 0,
    failed: 0,
    violations: 0,
  }
}

function emptyIndex(): AiPrototypeIndex {
  return {
    sessions: [],
    totals: emptyTotals(),
  }
}

function readIndex(vaultPath: string): AiPrototypeIndex {
  const indexPath = getIndexPath(vaultPath)
  if (!fs.pathExistsSync(indexPath)) {
    return emptyIndex()
  }

  try {
    const parsed = fs.readJsonSync(indexPath) as AiPrototypeIndex
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      totals: parsed.totals ?? emptyTotals(),
    }
  }
  catch {
    return emptyIndex()
  }
}

function writeIndex(vaultPath: string, index: AiPrototypeIndex): void {
  fs.ensureDirSync(getRootDir(vaultPath))
  fs.writeJsonSync(getIndexPath(vaultPath), index, { spaces: 2 })
}

function readSessionMeta(
  vaultPath: string,
  sessionId: string,
): AiPrototypeSessionMeta | null {
  const metaPath = path.join(getSessionDir(vaultPath, sessionId), 'meta.json')
  if (!fs.pathExistsSync(metaPath)) {
    return null
  }

  try {
    return fs.readJsonSync(metaPath) as AiPrototypeSessionMeta
  }
  catch {
    return null
  }
}

function writeSessionMeta(
  vaultPath: string,
  meta: AiPrototypeSessionMeta,
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
): AiPrototypeMessage | null {
  const filePath = messagePath(vaultPath, sessionId, messageId)
  if (!fs.pathExistsSync(filePath)) {
    return null
  }

  try {
    return fs.readJsonSync(filePath) as AiPrototypeMessage
  }
  catch {
    return null
  }
}

function writeMessage(vaultPath: string, message: AiPrototypeMessage): void {
  fs.ensureDirSync(getMessagesDir(vaultPath, message.sessionId))
  fs.writeJsonSync(
    messagePath(vaultPath, message.sessionId, message.id),
    message,
    { spaces: 2 },
  )
}

function truncateTitle(prompt: string): string {
  const trimmed = prompt.trim()
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

function recountSession(vaultPath: string, sessionId: string) {
  const messagesDir = getMessagesDir(vaultPath, sessionId)
  if (!fs.pathExistsSync(messagesDir)) {
    return {
      messageCount: 0,
      successCount: 0,
      failCount: 0,
    }
  }

  const files = fs
    .readdirSync(messagesDir)
    .filter(name => name.endsWith('.json'))
  let messageCount = 0
  let successCount = 0
  let failCount = 0
  let violationCount = 0

  for (const fileName of files) {
    const message = fs.readJsonSync(
      path.join(messagesDir, fileName),
    ) as AiPrototypeMessage
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
    if (message.status === 'violation') {
      violationCount += 1
    }
  }

  return { messageCount, successCount, failCount, violationCount }
}

function syncSessionSummary(vaultPath: string, sessionId: string) {
  const meta = readSessionMeta(vaultPath, sessionId)
  if (!meta) {
    return
  }

  const counts = recountSession(vaultPath, sessionId)
  const index = readIndex(vaultPath)
  const summary: AiPrototypeSessionSummary = {
    ...normalizeSessionMeta(meta),
    ...counts,
    deliverableCount: countSessionDeliverables(vaultPath, sessionId),
  }

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

function recomputeTotals(vaultPath: string): AiPrototypeIndexTotals {
  const index = readIndex(vaultPath)
  const totals = emptyTotals()

  for (const session of index.sessions) {
    totals.messages += session.messageCount
    totals.succeeded += session.successCount
    totals.failed += session.failCount
  }

  const messagesRoot = path.join(getRootDir(vaultPath), 'sessions')
  if (fs.pathExistsSync(messagesRoot)) {
    for (const sessionId of fs.readdirSync(messagesRoot)) {
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
        ) as AiPrototypeMessage
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

export function listAiPrototypeSessions(vaultPath: string): AiPrototypeIndex {
  return readIndex(vaultPath)
}

export function getAiPrototypeTotals(
  vaultPath: string,
): AiPrototypeIndexTotals {
  const index = readIndex(vaultPath)
  return index.totals
}

export function createAiPrototypeSession(
  vaultPath: string,
  payload?: { title?: string, skillId?: string },
): AiPrototypeSessionSummary {
  const now = Date.now()
  const id = randomUUID()
  const meta: AiPrototypeSessionMeta = {
    id,
    title: payload?.title?.trim() || 'Untitled',
    skillId: payload?.skillId?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }

  writeSessionMeta(vaultPath, meta)
  fs.ensureDirSync(getMessagesDir(vaultPath, id))
  ensureAiPrototypeSessionArtifacts(vaultPath, id)

  const summary: AiPrototypeSessionSummary = {
    ...normalizeSessionMeta(meta),
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

export function deleteAiPrototypeSession(
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

export function listAiPrototypeMessages(
  vaultPath: string,
  sessionId: string,
): AiPrototypeMessage[] {
  const messagesDir = getMessagesDir(vaultPath, sessionId)
  if (!fs.pathExistsSync(messagesDir)) {
    return []
  }

  return fs
    .readdirSync(messagesDir)
    .filter(name => name.endsWith('.json'))
    .map((name) => {
      return fs.readJsonSync(
        path.join(messagesDir, name),
      ) as AiPrototypeMessage
    })
    .sort((a, b) => a.createdAt - b.createdAt)
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

export function readAiPrototypeAssetBase64(
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

export function createAiPrototypeChatPair(
  vaultPath: string,
  sessionId: string,
  payload: {
    userText: string
    assistantContent?: string
    assistantStatus?: AiPrototypeMessage['status']
    assistantError?: string
  },
): { userMessage: AiPrototypeMessage, assistantMessage: AiPrototypeMessage } {
  const now = Date.now()
  const userMessage: AiPrototypeMessage = {
    id: randomUUID(),
    sessionId,
    role: 'user',
    kind: 'chat',
    createdAt: now,
    prompt: payload.userText,
  }

  const assistantMessage: AiPrototypeMessage = {
    id: randomUUID(),
    sessionId,
    role: 'assistant',
    kind: 'chat',
    createdAt: now + 1,
    content: payload.assistantContent,
    status: payload.assistantStatus,
    error: payload.assistantError,
    finishedAt: payload.assistantStatus ? Date.now() : undefined,
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

export function createAiPrototypeMessagePair(
  vaultPath: string,
  sessionId: string,
  payload: {
    prompt: string
    uploadAssetIds: string[]
    aspectRatio: string
    model: string
  },
): { userMessage: AiPrototypeMessage, assistantMessage: AiPrototypeMessage } {
  const now = Date.now()
  const userMessage: AiPrototypeMessage = {
    id: randomUUID(),
    sessionId,
    role: 'user',
    kind: 'image-generation',
    createdAt: now,
    prompt: payload.prompt,
    uploadAssetIds: payload.uploadAssetIds,
  }

  const assistantMessage: AiPrototypeMessage = {
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

export function updateAiPrototypeMessage(
  vaultPath: string,
  message: AiPrototypeMessage,
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

export function getAiPrototypeMessage(
  vaultPath: string,
  sessionId: string,
  messageId: string,
): AiPrototypeMessage | null {
  return readMessage(vaultPath, sessionId, messageId)
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

export function getAiPrototypeSpaceDir(vaultPath: string): string {
  return getSpaceDirPath(vaultPath, AI_PROTOTYPE_SPACE_ID)
}

function getSkillsDir(vaultPath: string): string {
  return path.join(getRootDir(vaultPath), AI_PROTOTYPE_SKILLS_DIR)
}

function walkArtifactMarkdown(
  dir: string,
  baseDir: string,
  results: Array<{ id: string, updatedAt: number }>,
): void {
  if (!fs.pathExistsSync(dir)) {
    return
  }

  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) {
      continue
    }

    const fullPath = path.join(dir, name)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      walkArtifactMarkdown(fullPath, baseDir, results)
      continue
    }

    if (!name.endsWith('.md')) {
      continue
    }

    const relativeId = path
      .relative(baseDir, fullPath)
      .split(path.sep)
      .join('/')
    results.push({ id: relativeId, updatedAt: stat.mtimeMs })
  }
}

function countSessionDeliverables(
  vaultPath: string,
  sessionId: string,
): number {
  return listAiPrototypeDeliverables(vaultPath, sessionId).length
}

export function listArtifactMarkdownIds(
  vaultPath: string,
  sessionId: string,
): string[] {
  return listAiPrototypeDeliverables(vaultPath, sessionId)
    .filter(item => item.kind === 'markdown')
    .map(item => item.id)
}

export function listAiPrototypeDeliverables(
  vaultPath: string,
  sessionId: string,
): AiPrototypeDeliverable[] {
  const deliverables: AiPrototypeDeliverable[] = []
  const artifactsDir = getArtifactsDir(vaultPath, sessionId)
  const markdownItems: Array<{ id: string, updatedAt: number }> = []

  walkArtifactMarkdown(artifactsDir, artifactsDir, markdownItems)

  for (const item of markdownItems) {
    deliverables.push({
      id: item.id,
      kind: 'markdown',
      name: path.basename(item.id, path.extname(item.id)) || item.id,
      updatedAt: item.updatedAt,
    })
  }

  const outputsDir = getOutputsDir(vaultPath, sessionId)
  if (fs.pathExistsSync(outputsDir)) {
    for (const fileName of fs.readdirSync(outputsDir)) {
      if (fileName.startsWith('.')) {
        continue
      }

      const filePath = path.join(outputsDir, fileName)
      if (!fs.statSync(filePath).isFile()) {
        continue
      }

      deliverables.push({
        id: fileName,
        kind: 'image',
        name: fileName,
        updatedAt: fs.statSync(filePath).mtimeMs,
      })
    }
  }

  return deliverables.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function readAiPrototypeDeliverableMarkdown(
  vaultPath: string,
  sessionId: string,
  deliverableId: string,
): string | null {
  const safeId = deliverableId.split(path.sep).join('/').replace(/\.\./g, '')
  const filePath = path.join(getArtifactsDir(vaultPath, sessionId), safeId)
  const artifactsDir = getArtifactsDir(vaultPath, sessionId)

  if (!filePath.startsWith(artifactsDir) || !fs.pathExistsSync(filePath)) {
    return null
  }

  const content = fs.readFileSync(filePath, 'utf8').trim()
  return content || null
}

export function createAiPrototypeDeliverableMessage(
  vaultPath: string,
  sessionId: string,
  deliverableId: string,
): AiPrototypeMessage {
  const message: AiPrototypeMessage = {
    id: randomUUID(),
    sessionId,
    role: 'assistant',
    kind: 'deliverable',
    createdAt: Date.now(),
    status: 'succeeded',
    deliverableId,
    content: deliverableId,
    finishedAt: Date.now(),
  }

  writeMessage(vaultPath, message)
  syncSessionSummary(vaultPath, sessionId)
  return message
}

export function createAiPrototypeImagePair(
  vaultPath: string,
  sessionId: string,
  payload: {
    prompt: string
    uploadAssetIds: string[]
    aspectRatio: string
    model: string
  },
): { userMessage: AiPrototypeMessage, assistantMessage: AiPrototypeMessage } {
  return createAiPrototypeMessagePair(vaultPath, sessionId, payload)
}

export function listAiPrototypeSkills(vaultPath: string): AiPrototypeSkill[] {
  const skills = [...BUILTIN_AI_PROTOTYPE_SKILLS]
  const skillsDir = getSkillsDir(vaultPath)

  if (fs.pathExistsSync(skillsDir)) {
    for (const fileName of fs.readdirSync(skillsDir)) {
      if (!fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) {
        continue
      }

      try {
        const parsed = yaml.load(
          fs.readFileSync(path.join(skillsDir, fileName), 'utf8'),
        ) as AiPrototypeSkill

        if (parsed?.id && parsed.name && parsed.systemPrompt) {
          skills.push({ ...parsed, builtin: false })
        }
      }
      catch {
        // skip invalid skill files
      }
    }
  }

  return skills.sort((a, b) => {
    if (Boolean(a.builtin) !== Boolean(b.builtin)) {
      return a.builtin ? -1 : 1
    }

    return a.name.localeCompare(b.name, 'zh-CN')
  })
}

export function getAiPrototypeSkill(
  vaultPath: string,
  skillId: string,
): AiPrototypeSkill | null {
  const builtin = getBuiltinAiPrototypeSkill(skillId)
  if (builtin) {
    return builtin
  }

  const skillsDir = getSkillsDir(vaultPath)
  const filePath = path.join(skillsDir, `${skillId}.yaml`)
  if (!fs.pathExistsSync(filePath)) {
    const ymlPath = path.join(skillsDir, `${skillId}.yml`)
    if (!fs.pathExistsSync(ymlPath)) {
      return null
    }

    try {
      return {
        ...(yaml.load(fs.readFileSync(ymlPath, 'utf8')) as AiPrototypeSkill),
        builtin: false,
      }
    }
    catch {
      return null
    }
  }

  try {
    return {
      ...(yaml.load(fs.readFileSync(filePath, 'utf8')) as AiPrototypeSkill),
      builtin: false,
    }
  }
  catch {
    return null
  }
}

export function resolveSessionSkill(
  vaultPath: string,
  session: AiPrototypeSessionMeta,
): AiPrototypeSkill | null {
  if (!session.skillId?.trim()) {
    return null
  }

  return getAiPrototypeSkill(vaultPath, session.skillId)
}

export function formatSessionMessagesForSkillDraft(
  messages: AiPrototypeMessage[],
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

function slugifySkillId(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4E00-\u9FFF-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return normalized || 'skill'
}

function skillIdExists(vaultPath: string, id: string): boolean {
  if (getBuiltinAiPrototypeSkill(id)) {
    return true
  }

  return (
    fs.pathExistsSync(path.join(getSkillsDir(vaultPath), `${id}.yaml`))
    || fs.pathExistsSync(path.join(getSkillsDir(vaultPath), `${id}.yml`))
  )
}

function resolveUniqueSkillId(vaultPath: string, baseId: string): string {
  let candidate = baseId
  let suffix = 1

  while (skillIdExists(vaultPath, candidate)) {
    candidate = `${baseId}-${suffix}`
    suffix += 1
  }

  return candidate
}

function serializeVaultSkill(skill: AiPrototypeSkill): string {
  const doc: Record<string, unknown> = {
    id: skill.id,
    name: skill.name,
    systemPrompt: skill.systemPrompt,
  }

  if (skill.tags?.length) {
    doc.tags = skill.tags
  }

  if (skill.defaults?.aspectRatio) {
    doc.defaults = { aspectRatio: skill.defaults.aspectRatio }
  }

  if (skill.deliverableHints?.length) {
    doc.deliverableHints = skill.deliverableHints
  }

  return yaml.dump(doc, { lineWidth: 120, noRefs: true })
}

function writeVaultSkill(
  vaultPath: string,
  skill: AiPrototypeSkill,
): AiPrototypeSkill {
  if (getBuiltinAiPrototypeSkill(skill.id)) {
    throw new Error('SKILL_BUILTIN_READONLY')
  }

  fs.ensureDirSync(getSkillsDir(vaultPath))
  fs.writeFileSync(
    path.join(getSkillsDir(vaultPath), `${skill.id}.yaml`),
    serializeVaultSkill({ ...skill, builtin: false }),
    'utf8',
  )

  return { ...skill, builtin: false }
}

export function createAiPrototypeSkill(
  vaultPath: string,
  payload: {
    id?: string
    name: string
    tags?: string[]
    systemPrompt: string
    defaults?: AiPrototypeSkill['defaults']
    deliverableHints?: string[]
  },
): AiPrototypeSkill {
  const name = payload.name.trim()
  const systemPrompt = payload.systemPrompt.trim()

  if (!name) {
    throw new Error('SKILL_NAME_MISSING')
  }

  if (!systemPrompt) {
    throw new Error('SKILL_PROMPT_MISSING')
  }

  const baseId = payload.id?.trim() || slugifySkillId(name)
  const id = resolveUniqueSkillId(vaultPath, baseId)

  return writeVaultSkill(vaultPath, {
    id,
    name,
    tags: payload.tags?.filter(Boolean),
    systemPrompt,
    defaults: payload.defaults,
    deliverableHints: payload.deliverableHints,
    builtin: false,
  })
}

export function updateAiPrototypeSkill(
  vaultPath: string,
  skillId: string,
  payload: {
    name?: string
    tags?: string[]
    systemPrompt?: string
    defaults?: AiPrototypeSkill['defaults'] | null
    deliverableHints?: string[]
  },
): AiPrototypeSkill {
  const existing = getAiPrototypeSkill(vaultPath, skillId)
  if (!existing) {
    throw new Error('SKILL_NOT_FOUND')
  }

  if (existing.builtin) {
    throw new Error('SKILL_BUILTIN_READONLY')
  }

  const name = payload.name?.trim() || existing.name
  const systemPrompt = payload.systemPrompt?.trim() || existing.systemPrompt

  if (!name) {
    throw new Error('SKILL_NAME_MISSING')
  }

  if (!systemPrompt) {
    throw new Error('SKILL_PROMPT_MISSING')
  }

  return writeVaultSkill(vaultPath, {
    id: skillId,
    name,
    tags: payload.tags ?? existing.tags,
    systemPrompt,
    defaults:
      payload.defaults === null
        ? undefined
        : (payload.defaults ?? existing.defaults),
    deliverableHints: payload.deliverableHints ?? existing.deliverableHints,
    builtin: false,
  })
}

export function deleteAiPrototypeSkill(
  vaultPath: string,
  skillId: string,
): boolean {
  const existing = getAiPrototypeSkill(vaultPath, skillId)
  if (!existing) {
    return false
  }

  if (existing.builtin) {
    throw new Error('SKILL_BUILTIN_READONLY')
  }

  const yamlPath = path.join(getSkillsDir(vaultPath), `${skillId}.yaml`)
  const ymlPath = path.join(getSkillsDir(vaultPath), `${skillId}.yml`)
  const filePath = fs.pathExistsSync(yamlPath) ? yamlPath : ymlPath

  if (!fs.pathExistsSync(filePath)) {
    return false
  }

  fs.removeSync(filePath)
  return true
}
