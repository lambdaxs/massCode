import type { BrowserWindow } from 'electron'
import { store } from '../../store'
import { syncIncremental } from './index'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export interface SyncStatusEvent {
  status: SyncStatus
  message?: string
  lastSyncAt?: number
}

class SyncScheduler {
  private debounceTimer: NodeJS.Timeout | null = null
  private idleTimer: NodeJS.Timeout | null = null
  private isSyncing = false
  private hasPendingChanges = false
  private mainWindow: BrowserWindow | null = null
  private isStarted = false

  // Get settings from store
  private get settings() {
    return store.preferences.get('sync')
  }

  private get isConfigured() {
    const { serverUrl, token, autoSync } = this.settings
    return !!serverUrl && !!token && autoSync
  }

  // Initialize with main window reference
  init(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
    // eslint-disable-next-line no-console
    console.log('[SyncScheduler] Initialized')
  }

  // Start the scheduler
  start() {
    if (this.isStarted || !this.isConfigured) {
      return
    }

    this.isStarted = true
    this.resetIdleTimer()
    // eslint-disable-next-line no-console
    console.log('[SyncScheduler] Started')

    // Sync on startup if enabled
    const { syncOnStartup } = this.settings
    if (syncOnStartup) {
      this.runSync()
    }
  }

  // Stop the scheduler
  stop() {
    this.isStarted = false
    this.clearDebounce()
    this.clearIdleTimer()
    // eslint-disable-next-line no-console
    console.log('[SyncScheduler] Stopped')
  }

  // Restart the scheduler (call when settings change)
  restart() {
    this.stop()
    if (this.isConfigured) {
      this.start()
    }
  }

  // Notify that data has changed (call from API routes)
  notifyChange() {
    if (!this.isConfigured || !this.isStarted) {
      return
    }

    this.hasPendingChanges = true
    this.resetDebounce()
  }

  // Flush sync immediately (call on blur/quit)
  async flushSync(): Promise<void> {
    this.clearDebounce()
    if (this.hasPendingChanges && this.isConfigured) {
      await this.runSync()
    }
  }

  // Check if currently syncing
  getIsSyncing(): boolean {
    return this.isSyncing
  }

  // Check if has pending changes
  getHasPendingChanges(): boolean {
    return this.hasPendingChanges
  }

  // Reset debounce timer
  private resetDebounce() {
    this.clearDebounce()
    const { debounceDelay } = this.settings
    this.debounceTimer = setTimeout(() => {
      this.runSync()
    }, debounceDelay)
  }

  // Clear debounce timer
  private clearDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  // Reset idle timer
  private resetIdleTimer() {
    this.clearIdleTimer()
    const { idleInterval } = this.settings
    this.idleTimer = setInterval(() => {
      if (this.hasPendingChanges) {
        this.runSync()
      }
    }, idleInterval)
  }

  // Clear idle timer
  private clearIdleTimer() {
    if (this.idleTimer) {
      clearInterval(this.idleTimer)
      this.idleTimer = null
    }
  }

  // Emit status to renderer
  private emitStatus(event: SyncStatusEvent) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:status-changed', event)
    }
  }

  // Execute sync with lock protection
  private async runSync(): Promise<void> {
    if (this.isSyncing || !this.isConfigured) {
      return
    }

    this.isSyncing = true
    this.emitStatus({ status: 'syncing' })

    try {
      const result = await syncIncremental()

      if (result.success) {
        this.hasPendingChanges = false
        this.emitStatus({
          status: 'success',
          lastSyncAt: result.syncedAt,
        })
        // eslint-disable-next-line no-console
        console.log('[SyncScheduler] Auto sync completed successfully')
      }
      else {
        this.emitStatus({
          status: 'error',
          message: result.message,
        })
        console.error('[SyncScheduler] Auto sync failed:', result.message)
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.emitStatus({
        status: 'error',
        message,
      })
      console.error('[SyncScheduler] Auto sync error:', message)
    }
    finally {
      this.isSyncing = false
      // Reset idle timer after sync attempt
      if (this.isStarted) {
        this.resetIdleTimer()
      }
    }
  }
}

// Export singleton instance
export const syncScheduler = new SyncScheduler()
