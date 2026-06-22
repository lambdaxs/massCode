export type TaskTimerStatus = 'idle' | 'running' | 'paused'

export interface TaskTimerState {
  noteId: number | null
  title: string
  status: TaskTimerStatus
  elapsedMs: number
}

export const TASK_TIMER_IDLE_STATE: TaskTimerState = {
  noteId: null,
  title: '',
  status: 'idle',
  elapsedMs: 0,
}

export function formatTaskTimerElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatTaskTimerDisplayLine(
  title: string,
  elapsedMs: number,
): string {
  const trimmed = title.trim()
  if (!trimmed) {
    return formatTaskTimerElapsed(elapsedMs)
  }

  return `${trimmed} ${formatTaskTimerElapsed(elapsedMs)}`
}
