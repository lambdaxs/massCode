import { randomBytes } from 'node:crypto'
import path from 'node:path'
import fs from 'fs-extra'
import { useNotesStorage } from '../storage'
import {
  getAiPrototypeOutputAssetPath,
  listAiPrototypeDeliverables,
  readAiPrototypeDeliverableMarkdown,
  readAiPrototypeSessionMeta,
} from '../storage/providers/markdown/aiPrototype'
import { getVaultPath } from '../storage/providers/markdown/runtime/paths'
import { ensureFlatSpacesLayout } from '../storage/providers/markdown/runtime/spaces'

function generateNotesAssetId(): string {
  return randomBytes(12).toString('base64url')
}

function copyImageToNotesAsset(sourcePath: string): string {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    throw new Error('VAULT_NOT_READY')
  }

  ensureFlatSpacesLayout(vaultPath)
  const ext = path.extname(sourcePath) || '.png'
  const name = `${generateNotesAssetId()}${ext}`
  const assetsDir = path.join(vaultPath, 'notes', 'assets')
  const destination = path.join(assetsDir, name)

  fs.ensureDirSync(assetsDir)
  fs.copyFileSync(sourcePath, destination)

  return `masscode://notes-asset/${name}`
}

function getUniqueNoteName(folderId: number | null, baseName: string): string {
  const storage = useNotesStorage()
  const notes
    = folderId === null
      ? storage.notes.getNotes({ isInbox: 1, isDeleted: 0 })
      : storage.notes.getNotes({ folderId, isDeleted: 0 })
  const names = new Set(notes.map(note => note.name.toLowerCase()))
  const normalizedBase = baseName.trim() || 'Prototype Design'

  if (!names.has(normalizedBase.toLowerCase())) {
    return normalizedBase
  }

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidate = `${normalizedBase} ${suffix}`
    if (!names.has(candidate.toLowerCase())) {
      return candidate
    }
  }

  return `${normalizedBase} ${Date.now()}`
}

export function exportAiPrototypeDeliverableToNotes(
  sessionId: string,
  deliverableId: string,
  folderId: number | null,
): { noteId: number, noteName: string } {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    throw new Error('VAULT_NOT_READY')
  }

  const session = readAiPrototypeSessionMeta(vaultPath, sessionId)
  if (!session) {
    throw new Error('SESSION_NOT_FOUND')
  }

  const deliverable = listAiPrototypeDeliverables(vaultPath, sessionId).find(
    item => item.id === deliverableId,
  )
  if (!deliverable) {
    throw new Error('DELIVERABLE_MISSING')
  }

  let content = ''
  let noteName = deliverable.name

  if (deliverable.kind === 'markdown') {
    const markdown = readAiPrototypeDeliverableMarkdown(
      vaultPath,
      sessionId,
      deliverableId,
    )
    if (!markdown) {
      throw new Error('DELIVERABLE_MISSING')
    }

    content = `${markdown.trimEnd()}\n`
    noteName = path.basename(deliverableId, path.extname(deliverableId))
  }
  else {
    const sourcePath = getAiPrototypeOutputAssetPath(
      vaultPath,
      sessionId,
      deliverableId,
    )
    if (!fs.pathExistsSync(sourcePath)) {
      throw new Error('DELIVERABLE_MISSING')
    }

    const imageUrl = copyImageToNotesAsset(sourcePath)
    content = `# ${deliverable.name}\n\n![${deliverable.name}](${imageUrl})\n`
  }

  const uniqueName = getUniqueNoteName(folderId, noteName)
  const storage = useNotesStorage()
  const { id } = storage.notes.createNote({
    folderId: folderId ?? undefined,
    name: uniqueName,
  })
  storage.notes.updateNoteContent(id, content)

  return {
    noteId: id,
    noteName: uniqueName,
  }
}

export function exportAiPrototypeDeliverablesToNotes(
  sessionId: string,
  folderId: number | null,
): {
    notes: Array<{ noteId: number, noteName: string, deliverableId: string }>
  } {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    throw new Error('VAULT_NOT_READY')
  }

  const session = readAiPrototypeSessionMeta(vaultPath, sessionId)
  if (!session) {
    throw new Error('SESSION_NOT_FOUND')
  }

  const deliverables = listAiPrototypeDeliverables(vaultPath, sessionId)
  if (!deliverables.length) {
    throw new Error('DELIVERABLES_EMPTY')
  }

  const notes: Array<{
    noteId: number
    noteName: string
    deliverableId: string
  }> = []

  for (const item of [...deliverables].reverse()) {
    try {
      const exported = exportAiPrototypeDeliverableToNotes(
        sessionId,
        item.id,
        folderId,
      )
      notes.push({
        ...exported,
        deliverableId: item.id,
      })
    }
    catch (error) {
      if (error instanceof Error && error.message === 'DELIVERABLE_MISSING') {
        continue
      }
      throw error
    }
  }

  if (!notes.length) {
    throw new Error('DELIVERABLES_EMPTY')
  }

  return { notes }
}
