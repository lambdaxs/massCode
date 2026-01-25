import { Elysia, t } from 'elysia'
import {
  getSyncStatus,
  recordDeletionForSync,
  syncFull,
  syncIncremental,
  testConnection,
} from '../../services/sync'
import { store } from '../../store'

const app = new Elysia({ prefix: '/sync' })

// Get sync status
app.get(
  '/status',
  () => {
    return getSyncStatus()
  },
  {
    detail: { tags: ['Sync'] },
  },
)

// Test connection to sync server
app.post(
  '/test-connection',
  async () => {
    return testConnection()
  },
  {
    detail: { tags: ['Sync'] },
  },
)

// Perform incremental sync
app.post(
  '/incremental',
  async () => {
    return syncIncremental()
  },
  {
    detail: { tags: ['Sync'] },
  },
)

// Perform full sync (overwrite local with server data)
app.post(
  '/full',
  async () => {
    return syncFull()
  },
  {
    detail: { tags: ['Sync'] },
  },
)

// Update sync settings
app.put(
  '/settings',
  ({ body }) => {
    if (body.serverUrl !== undefined) {
      store.preferences.set('sync.serverUrl', body.serverUrl)
    }
    if (body.token !== undefined) {
      store.preferences.set('sync.token', body.token)
    }
    if (body.autoSync !== undefined) {
      store.preferences.set('sync.autoSync', body.autoSync)
    }
    return { success: true }
  },
  {
    body: t.Object({
      serverUrl: t.Optional(t.String()),
      token: t.Optional(t.String()),
      autoSync: t.Optional(t.Boolean()),
    }),
    detail: { tags: ['Sync'] },
  },
)

// Get sync settings
app.get(
  '/settings',
  () => {
    const syncConfig = store.preferences.get('sync')
    return {
      serverUrl: syncConfig.serverUrl,
      token: syncConfig.token,
      autoSync: syncConfig.autoSync,
      lastSyncAt: syncConfig.lastSyncAt,
      deviceId: syncConfig.deviceId,
    }
  },
  {
    detail: { tags: ['Sync'] },
  },
)

// Record deletion for sync (used by other routes when deleting folders/tags)
app.post(
  '/record-deletion',
  ({ body }) => {
    recordDeletionForSync(body.tableName, body.localId)
    return { success: true }
  },
  {
    body: t.Object({
      tableName: t.Union([
        t.Literal('folders'),
        t.Literal('tags'),
        t.Literal('snippet_contents'),
      ]),
      localId: t.Number(),
    }),
    detail: { tags: ['Sync'] },
  },
)

export default app
