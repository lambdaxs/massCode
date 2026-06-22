import type { TaskTimerState } from '~/shared/taskTimer'
import { ipc } from '@/electron'
import { isMac } from '@/utils'
import { TASK_TIMER_IDLE_STATE } from '~/shared/taskTimer'

const state = reactive<TaskTimerState>({ ...TASK_TIMER_IDLE_STATE })
let isInitialized = false

function applyState(next: TaskTimerState) {
  state.noteId = next.noteId
  state.title = next.title
  state.status = next.status
  state.elapsedMs = next.elapsedMs
}

async function syncState() {
  if (!isMac) {
    return
  }

  const next = await ipc.invoke('system:task-timer-get-state', null)
  applyState(next)
}

function ensureListener() {
  if (isInitialized || !isMac) {
    return
  }

  ipc.on('system:task-timer-changed', (_, payload: TaskTimerState) => {
    applyState(payload)
  })

  isInitialized = true
}

export function useTaskTimer() {
  ensureListener()
  void syncState()

  onMounted(() => {
    void syncState()
  })

  function isForNote(noteId: number) {
    return state.noteId === noteId && state.status !== 'idle'
  }

  function isRunningForNote(noteId: number) {
    return state.noteId === noteId && state.status === 'running'
  }

  function isPausedForNote(noteId: number) {
    return state.noteId === noteId && state.status === 'paused'
  }

  async function start(noteId: number, title: string) {
    if (!isMac) {
      return
    }

    applyState(await ipc.invoke('system:task-timer-start', { noteId, title }))
  }

  async function pause() {
    if (!isMac) {
      return
    }

    applyState(await ipc.invoke('system:task-timer-pause', null))
  }

  async function resume() {
    if (!isMac) {
      return
    }

    applyState(await ipc.invoke('system:task-timer-resume', null))
  }

  async function stop() {
    if (!isMac) {
      return
    }

    applyState(await ipc.invoke('system:task-timer-stop', null))
  }

  async function updateTitle(title: string) {
    if (!isMac || state.status === 'idle') {
      return
    }

    applyState(await ipc.invoke('system:task-timer-update-title', { title }))
  }

  async function openMain() {
    if (!isMac) {
      return
    }

    await ipc.invoke('system:task-timer-open-main', null)
  }

  return {
    state: readonly(state),
    isForNote,
    isRunningForNote,
    isPausedForNote,
    start,
    pause,
    resume,
    stop,
    updateTitle,
    openMain,
  }
}
