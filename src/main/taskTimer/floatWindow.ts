import path from 'node:path'
import process from 'node:process'
import { BrowserWindow, nativeTheme, screen } from 'electron'
import {
  TASK_TIMER_FLOAT_HEIGHT,
  TASK_TIMER_FLOAT_WIDTH,
} from '../../shared/taskTimerFloat'
import { store } from '../store'

const FLOAT_MARGIN = 16
const FLOAT_BACKGROUND_LIGHT = '#ffffff'
const FLOAT_BACKGROUND_DARK = '#3f3f3f'

let floatWindow: BrowserWindow | null = null
let isDev = false
let onReady: (() => void) | null = null
let pendingShow = false

export function configureTaskTimerFloatWindow(options: {
  isDev: boolean
  onReady?: () => void
}) {
  isDev = options.isDev
  onReady = options.onReady ?? null
}

function getSavedPosition(): { x: number, y: number } | null {
  const saved = store.app.get('taskTimer.floatPosition') as
    | { x: number, y: number }
    | null
    | undefined

  if (
    saved
    && typeof saved.x === 'number'
    && typeof saved.y === 'number'
    && Number.isFinite(saved.x)
    && Number.isFinite(saved.y)
  ) {
    return saved
  }

  return null
}

function getDefaultPosition() {
  const display = screen.getPrimaryDisplay()
  const { workArea } = display

  return {
    x: workArea.x + workArea.width - TASK_TIMER_FLOAT_WIDTH - FLOAT_MARGIN,
    y: workArea.y + workArea.height - TASK_TIMER_FLOAT_HEIGHT - FLOAT_MARGIN,
  }
}

function getInitialFloatBackgroundColor(): string {
  const themeId = String(store.preferences.get('appearance.theme') || 'auto')

  if (themeId === 'dark') {
    return FLOAT_BACKGROUND_DARK
  }

  if (themeId === 'light') {
    return FLOAT_BACKGROUND_LIGHT
  }

  return nativeTheme.shouldUseDarkColors
    ? FLOAT_BACKGROUND_DARK
    : FLOAT_BACKGROUND_LIGHT
}

function savePosition(bounds: { x: number, y: number }) {
  store.app.set('taskTimer.floatPosition', bounds)
}

function loadFloatContent(window: BrowserWindow) {
  if (isDev) {
    void window.loadURL(
      `http://localhost:${process.env.DEV_PORT || 5177}/task-timer-float.html`,
    )
    return
  }

  void window.loadFile(
    path.join(__dirname, '../../build/renderer/task-timer-float.html'),
  )
}

function attachFloatWindowListeners(window: BrowserWindow) {
  window.on('moved', () => {
    if (window.isDestroyed()) {
      return
    }

    const [x, y] = window.getPosition()
    savePosition({ x, y })
  })
}

function revealFloatWindow() {
  if (!floatWindow || floatWindow.isDestroyed()) {
    return
  }

  floatWindow.showInactive()
  pendingShow = false
}

function createFloatWindow() {
  const position = getSavedPosition() ?? getDefaultPosition()

  floatWindow = new BrowserWindow({
    x: position.x,
    y: position.y,
    width: TASK_TIMER_FLOAT_WIDTH,
    height: TASK_TIMER_FLOAT_HEIGHT,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: getInitialFloatBackgroundColor(),
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: true,
    focusable: true,
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: true,
      webSecurity: false,
    },
  })

  floatWindow.setAlwaysOnTop(true, 'floating')
  floatWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  floatWindow.setSize(TASK_TIMER_FLOAT_WIDTH, TASK_TIMER_FLOAT_HEIGHT, false)

  attachFloatWindowListeners(floatWindow)

  floatWindow.once('ready-to-show', () => {
    if (pendingShow) {
      revealFloatWindow()
    }
  })

  floatWindow.webContents.once('did-finish-load', () => {
    onReady?.()
  })

  loadFloatContent(floatWindow)

  floatWindow.on('closed', () => {
    floatWindow = null
    pendingShow = false
  })
}

export function showTaskTimerFloatWindow() {
  if (!floatWindow || floatWindow.isDestroyed()) {
    pendingShow = true
    createFloatWindow()
    return
  }

  if (!floatWindow.isVisible()) {
    revealFloatWindow()
  }
}

export function hideTaskTimerFloatWindow() {
  if (!floatWindow || floatWindow.isDestroyed()) {
    return
  }

  floatWindow.hide()
}

export function destroyTaskTimerFloatWindow() {
  if (!floatWindow || floatWindow.isDestroyed()) {
    floatWindow = null
    pendingShow = false
    return
  }

  floatWindow.destroy()
  floatWindow = null
  pendingShow = false
}

export function setTaskTimerFloatBackgroundColor(isDark: boolean) {
  if (!floatWindow || floatWindow.isDestroyed()) {
    return
  }

  floatWindow.setBackgroundColor(
    isDark ? FLOAT_BACKGROUND_DARK : FLOAT_BACKGROUND_LIGHT,
  )
}

export function getTaskTimerFloatWebContents() {
  return floatWindow?.isDestroyed() ? null : (floatWindow?.webContents ?? null)
}
