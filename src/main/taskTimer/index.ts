import type { TaskTimerState } from '../../shared/taskTimer'
import process from 'node:process'
import { BrowserWindow } from 'electron'
import { TASK_TIMER_IDLE_STATE } from '../../shared/taskTimer'
import {
  configureTaskTimerFloatWindow,
  destroyTaskTimerFloatWindow,
  hideTaskTimerFloatWindow,
  showTaskTimerFloatWindow,
} from './floatWindow'

interface TaskTimerRuntime {
  noteId: number | null
  title: string
  status: TaskTimerState['status']
  elapsedMs: number
  startedAt: number | null
}

const runtime: TaskTimerRuntime = { ...TASK_TIMER_IDLE_STATE, startedAt: null }

let tickTimer: ReturnType<typeof setInterval> | null = null

function isSupported() {
  return process.platform === 'darwin'
}

function getElapsedMs(): number {
  if (runtime.status === 'running' && runtime.startedAt !== null) {
    return runtime.elapsedMs + (Date.now() - runtime.startedAt)
  }

  return runtime.elapsedMs
}

function toState(): TaskTimerState {
  return {
    noteId: runtime.noteId,
    title: runtime.title,
    status: runtime.status,
    elapsedMs: getElapsedMs(),
  }
}

function broadcastState() {
  const payload = toState()

  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('system:task-timer-changed', payload)
    }
  })
}

function stopTick() {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

function startTick() {
  stopTick()
  tickTimer = setInterval(() => {
    broadcastState()
  }, 1000)
}

function resetRuntime() {
  runtime.noteId = null
  runtime.title = ''
  runtime.status = 'idle'
  runtime.elapsedMs = 0
  runtime.startedAt = null
}

export function configureTaskTimer(options: { isDev: boolean }) {
  configureTaskTimerFloatWindow({
    isDev: options.isDev,
    onReady: () => {
      broadcastState()
    },
  })
}

export function getTaskTimerState(): TaskTimerState {
  return toState()
}

export function startTaskTimer(noteId: number, title: string): TaskTimerState {
  if (!isSupported()) {
    return toState()
  }

  if (
    runtime.status !== 'idle'
    && runtime.noteId !== null
    && runtime.noteId !== noteId
  ) {
    stopTaskTimer()
  }

  if (runtime.status === 'paused' && runtime.noteId === noteId) {
    return resumeTaskTimer()
  }

  runtime.noteId = noteId
  runtime.title = title
  runtime.elapsedMs = 0
  runtime.status = 'running'
  runtime.startedAt = Date.now()

  showTaskTimerFloatWindow()
  startTick()
  broadcastState()

  return toState()
}

export function resumeTaskTimer(): TaskTimerState {
  if (
    !isSupported()
    || runtime.status !== 'paused'
    || runtime.noteId === null
  ) {
    return toState()
  }

  runtime.status = 'running'
  runtime.startedAt = Date.now()

  showTaskTimerFloatWindow()
  startTick()
  broadcastState()

  return toState()
}

export function pauseTaskTimer(): TaskTimerState {
  if (!isSupported() || runtime.status !== 'running') {
    return toState()
  }

  runtime.elapsedMs = getElapsedMs()
  runtime.status = 'paused'
  runtime.startedAt = null

  stopTick()
  showTaskTimerFloatWindow()
  broadcastState()

  return toState()
}

export function stopTaskTimer(): TaskTimerState {
  stopTick()
  hideTaskTimerFloatWindow()
  destroyTaskTimerFloatWindow()
  resetRuntime()
  broadcastState()

  return toState()
}

export function updateTaskTimerTitle(title: string): TaskTimerState {
  if (runtime.status === 'idle' || !title.trim()) {
    return toState()
  }

  runtime.title = title
  broadcastState()

  return toState()
}

export function disposeTaskTimer() {
  stopTaskTimer()
}
