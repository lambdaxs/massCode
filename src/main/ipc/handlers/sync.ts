import type { SyncEnableOptions, SyncRegisterOptions } from '../../types/ipc'
/**
 * IPC handlers for sync functionality
 */
import { ipcMain } from 'electron'
import { syncScheduler } from '../../services/sync'
import { SyncService } from '../../sync'
import { SyncApiClient } from '../../sync/api'

let syncService: SyncService | null = null

export function registerSyncHandlers() {
  ipcMain.handle('sync:restart-scheduler', () => {
    syncScheduler.restart()
    return { success: true }
  })

  // Get sync status
  ipcMain.handle('sync:get-status', async () => {
    if (!syncService) {
      syncService = new SyncService()
    }
    return syncService.getSyncState()
  })

  // Enable sync
  ipcMain.handle('sync:enable', async (_event, options: SyncEnableOptions) => {
    if (!syncService) {
      syncService = new SyncService()
    }
    syncService.enableSync(options.serverUrl, options.userId, options.apiKey)
    return { success: true }
  })

  // Disable sync
  ipcMain.handle('sync:disable', async () => {
    if (!syncService) {
      syncService = new SyncService()
    }
    syncService.disableSync()
    return { success: true }
  })

  // Sync now
  ipcMain.handle('sync:sync-now', async () => {
    if (!syncService) {
      syncService = new SyncService()
    }
    return await syncService.sync()
  })

  // Register new user
  ipcMain.handle(
    'sync:register',
    async (_event, options: SyncRegisterOptions) => {
      try {
        const result = await SyncApiClient.register(options.serverUrl, {
          email: options.email,
        })
        return { success: true, data: result }
      }
      catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Registration failed',
        }
      }
    },
  )
}
