import path from 'node:path'
import { useNotesStorage } from '../storage'
import {
  listAiOperationsDeliverables,
  readAiOperationsDeliverable,
  readAiOperationsSessionMeta,
} from '../storage/providers/markdown/aiOperations'
import { getVaultPath } from '../storage/providers/markdown/runtime/paths'
import { ensureFlatSpacesLayout } from '../storage/providers/markdown/runtime/spaces'

function getUniqueNoteName(
  folderId: number | null,
  baseName: string,
  reservedNames: Set<string> = new Set(),
): string {
  const storage = useNotesStorage()
  const notes
    = folderId === null
      ? storage.notes.getNotes({ isInbox: 1, isDeleted: 0 })
      : storage.notes.getNotes({ folderId, isDeleted: 0 })
  const names = new Set([
    ...notes.map(note => note.name.toLowerCase()),
    ...reservedNames,
  ])
  const normalizedBase = baseName.trim() || 'Operations'

  if (!names.has(normalizedBase.toLowerCase())) {
    reservedNames.add(normalizedBase.toLowerCase())
    return normalizedBase
  }

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidate = `${normalizedBase} ${suffix}`
    if (!names.has(candidate.toLowerCase())) {
      reservedNames.add(candidate.toLowerCase())
      return candidate
    }
  }

  const fallback = `${normalizedBase} ${Date.now()}`
  reservedNames.add(fallback.toLowerCase())
  return fallback
}

function noteNameFromFileName(fileName: string): string {
  return path.basename(fileName, path.extname(fileName)).trim() || 'Operations'
}

function exportDeliverableContentToNotes(
  folderId: number | null,
  fileName: string,
  content: string,
  reservedNames: Set<string>,
): { noteId: number, noteName: string } {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    throw new Error('VAULT_NOT_READY')
  }

  ensureFlatSpacesLayout(vaultPath)

  const noteName = getUniqueNoteName(
    folderId,
    noteNameFromFileName(fileName),
    reservedNames,
  )
  const storage = useNotesStorage()
  const { id } = storage.notes.createNote({
    folderId: folderId ?? undefined,
    name: noteName,
  })
  storage.notes.updateNoteContent(id, `${content.trimEnd()}\n`)

  return {
    noteId: id,
    noteName,
  }
}

export function exportAiOperationsDeliverableToNotes(
  sessionId: string,
  fileName: string,
  folderId: number | null,
): { noteId: number, noteName: string } {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    throw new Error('VAULT_NOT_READY')
  }

  const session = readAiOperationsSessionMeta(vaultPath, sessionId)
  if (!session) {
    throw new Error('SESSION_NOT_FOUND')
  }

  const content = readAiOperationsDeliverable(vaultPath, sessionId, fileName)
  if (!content?.trim()) {
    throw new Error('DELIVERABLE_MISSING')
  }

  return exportDeliverableContentToNotes(
    folderId,
    fileName,
    content,
    new Set(),
  )
}

export function exportAiOperationsDeliverablesToNotes(
  sessionId: string,
  folderId: number | null,
): { notes: Array<{ noteId: number, noteName: string, fileName: string }> } {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    throw new Error('VAULT_NOT_READY')
  }

  const session = readAiOperationsSessionMeta(vaultPath, sessionId)
  if (!session) {
    throw new Error('SESSION_NOT_FOUND')
  }

  const deliverables = listAiOperationsDeliverables(vaultPath, sessionId)
  if (!deliverables.length) {
    throw new Error('DELIVERABLES_EMPTY')
  }

  const reservedNames = new Set<string>()
  const notes: Array<{ noteId: number, noteName: string, fileName: string }>
    = []

  for (const item of [...deliverables].reverse()) {
    const content = readAiOperationsDeliverable(
      vaultPath,
      sessionId,
      item.fileName,
    )
    if (!content?.trim()) {
      continue
    }

    const exported = exportDeliverableContentToNotes(
      folderId,
      item.fileName,
      content,
      reservedNames,
    )

    notes.push({
      ...exported,
      fileName: item.fileName,
    })
  }

  if (!notes.length) {
    throw new Error('DELIVERABLES_EMPTY')
  }

  return { notes }
}
