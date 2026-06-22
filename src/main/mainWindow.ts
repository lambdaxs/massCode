import type { BrowserWindow } from 'electron'
import process from 'node:process'
import { app } from 'electron'

let mainWindow: BrowserWindow | null = null

export function registerMainWindow(window: BrowserWindow) {
  mainWindow = window
}

export function getMainWindow(): BrowserWindow | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null
  }

  return mainWindow
}

export function focusMainWindow() {
  const window = getMainWindow()

  if (!window) {
    return false
  }

  if (window.isMinimized()) {
    window.restore()
  }

  if (!window.isVisible()) {
    window.show()
  }

  window.focus()

  if (process.platform === 'darwin') {
    app.focus({ steal: true })
  }

  return true
}
