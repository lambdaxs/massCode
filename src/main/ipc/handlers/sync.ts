import { ipcMain } from 'electron'
import { syncScheduler } from '../../services/sync'

export function registerSyncHandlers() {
  ipcMain.handle('sync:restart-scheduler', () => {
    syncScheduler.restart()
    return { success: true }
  })
}
