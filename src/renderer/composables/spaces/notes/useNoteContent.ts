import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { api } from '~/renderer/services/api'
import { notes, selectedNoteRecord } from './useNotes'
import { notesBySearch } from './useNoteSearch'

// --- Module-level state ---

// 队列无需 reactive：无人订阅，且操作在每次按键时执行。
const contentUpdateQueue = new Map<number, string>()
const contentUpdateTimers = new Map<number, ReturnType<typeof setTimeout>>()
const inFlightContentUpdateIds = new Set<number>()

const CONTENT_UPDATE_DEBOUNCE_MS = 500

// --- Functions ---

function updateLocalNoteContent(noteId: number, content: string) {
  const now = Date.now()

  // content 仅存在于选中 note 的完整记录中。
  // 原地 mutate 不替换对象：编辑器已有该文本，
  // 无需每次按键触发 reactive 级联。
  const record = selectedNoteRecord.value
  if (record?.id === noteId) {
    record.content = content
    record.updatedAt = now
  }

  function touchCollection(collection?: { id: number, updatedAt: number }[]) {
    const note = collection?.find(item => item.id === noteId)
    if (note) {
      note.updatedAt = now
    }
  }

  touchCollection(notes.value)
  touchCollection(notesBySearch.value)
}

function scheduleContentUpdate(noteId: number) {
  const currentTimer = contentUpdateTimers.get(noteId)
  if (currentTimer) {
    clearTimeout(currentTimer)
  }

  const timer = setTimeout(() => {
    contentUpdateTimers.delete(noteId)
    void flushContentUpdate(noteId)
  }, CONTENT_UPDATE_DEBOUNCE_MS)

  contentUpdateTimers.set(noteId, timer)
}

async function flushContentUpdate(noteId: number) {
  const content = contentUpdateQueue.get(noteId)
  if (content === undefined) {
    return
  }

  contentUpdateQueue.delete(noteId)
  inFlightContentUpdateIds.add(noteId)

  try {
    markPersistedStorageMutation()
    await api.notes.patchNotesByIdContent(String(noteId), { content })
  }
  catch (error) {
    console.error(error)
  }
  finally {
    inFlightContentUpdateIds.delete(noteId)

    if (contentUpdateQueue.has(noteId)) {
      scheduleContentUpdate(noteId)
    }
  }
}

function hasBusyNoteContentUpdates() {
  return contentUpdateQueue.size > 0 || inFlightContentUpdateIds.size > 0
}

function updateNoteContent(noteId: number, content: string) {
  updateLocalNoteContent(noteId, content)
  contentUpdateQueue.set(noteId, content)

  if (inFlightContentUpdateIds.has(noteId)) {
    return
  }

  scheduleContentUpdate(noteId)
}

export function useNoteContent() {
  return {
    hasBusyNoteContentUpdates,
    updateNoteContent,
  }
}
