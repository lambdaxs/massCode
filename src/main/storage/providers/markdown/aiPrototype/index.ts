import type {
  AiPrototypeIndex,
  AiPrototypeIndexTotals,
  AiPrototypeMessage,
  AiPrototypeSessionMeta,
  AiPrototypeSessionSummary,
} from '../../../../../shared/aiPrototype'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'fs-extra'
import { request as undiciRequest } from 'undici'
import { AI_PROTOTYPE_SPACE_ID } from '../../../../../shared/aiPrototype'
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
    ...meta,
    ...counts,
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
): AiPrototypeSessionSummary {
  const now = Date.now()
  const id = randomUUID()
  const meta: AiPrototypeSessionMeta = {
    id,
    title: 'Untitled',
    createdAt: now,
    updatedAt: now,
  }

  writeSessionMeta(vaultPath, meta)
  fs.ensureDirSync(getMessagesDir(vaultPath, id))

  const summary: AiPrototypeSessionSummary = {
    ...meta,
    messageCount: 0,
    successCount: 0,
    failCount: 0,
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
    createdAt: now,
    prompt: payload.prompt,
    uploadAssetIds: payload.uploadAssetIds,
  }

  const assistantMessage: AiPrototypeMessage = {
    id: randomUUID(),
    sessionId,
    role: 'assistant',
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
