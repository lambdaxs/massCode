import type {
  DBFolder,
  DBSnippet,
  DBSnippetContent,
  DBSnippetTag,
  DBSyncDeletion,
  DBSyncIdMap,
  DBTag,
  FullSyncResponse,
  PullResponse,
  PushChangeItem,
  PushRequest,
  PushResponse,
  PushSnippetTagItem,
  SyncDeletionData,
  SyncResult,
  SyncTableName,
  TestConnectionResponse,
} from './types'
import { useDB } from '../../db'
import { store } from '../../store'
import { log } from '../../utils'

// Re-export scheduler
export { syncScheduler } from './scheduler'
export type { SyncStatus, SyncStatusEvent } from './scheduler'

// Helper: Get server ID from local ID
function getServerId(tableName: SyncTableName, localId: number): string | null {
  const db = useDB()
  const row = db
    .prepare(
      'SELECT serverId FROM sync_id_map WHERE tableName = ? AND localId = ?',
    )
    .get(tableName, localId) as DBSyncIdMap | undefined
  return row?.serverId ?? null
}

// Helper: Get local ID from server ID
function getLocalId(tableName: SyncTableName, serverId: string): number | null {
  const db = useDB()
  const row = db
    .prepare(
      'SELECT localId FROM sync_id_map WHERE tableName = ? AND serverId = ?',
    )
    .get(tableName, serverId) as DBSyncIdMap | undefined
  return row?.localId ?? null
}

// Helper: Save ID mapping
function saveIdMapping(
  tableName: SyncTableName,
  localId: number,
  serverId: string,
) {
  const db = useDB()
  db.prepare(
    `
    INSERT OR REPLACE INTO sync_id_map (tableName, localId, serverId)
    VALUES (?, ?, ?)
  `,
  ).run(tableName, localId, serverId)
}

// Helper: Delete ID mapping
function deleteIdMapping(tableName: SyncTableName, serverId: string) {
  const db = useDB()
  db.prepare(
    'DELETE FROM sync_id_map WHERE tableName = ? AND serverId = ?',
  ).run(tableName, serverId)
}

// Helper: HTTP request to sync server
async function syncRequest<T>(endpoint: string, data?: unknown): Promise<T> {
  const syncConfig = store.preferences.get('sync')
  const { serverUrl, token } = syncConfig

  if (!serverUrl || !token) {
    throw new Error('Sync server not configured')
  }

  const url = `${serverUrl.replace(/\/$/, '')}${endpoint}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: data ? JSON.stringify(data) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Sync request failed: ${response.status} ${errorText}`)
  }

  return response.json() as Promise<T>
}

// Test connection to sync server
export async function testConnection(): Promise<TestConnectionResponse> {
  try {
    const result = await syncRequest<{ serverTime: number }>('/api/sync/ping')
    return {
      success: true,
      message: 'Connection successful',
      serverTime: result.serverTime,
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message,
    }
  }
}

// Collect local changes since last sync
function collectLocalChanges(lastSyncAt: number): PushRequest {
  const db = useDB()

  // Get changed folders
  const folders = db
    .prepare('SELECT * FROM folders WHERE updatedAt > ?')
    .all(lastSyncAt) as DBFolder[]

  const folderChanges: PushChangeItem<Omit<DBFolder, 'id'>>[] = folders.map(
    (f) => {
      const serverId = getServerId('folders', f.id)
      const parentServerId = f.parentId
        ? getServerId('folders', f.parentId)
        : null
      return {
        serverId,
        localId: f.id,
        isNew: !serverId,
        data: {
          name: f.name,
          defaultLanguage: f.defaultLanguage,
          parentId: parentServerId,
          isOpen: f.isOpen,
          orderIndex: f.orderIndex,
          icon: f.icon,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        } as unknown as Omit<DBFolder, 'id'>,
      }
    },
  )

  // Get changed snippets
  const snippets = db
    .prepare('SELECT * FROM snippets WHERE updatedAt > ?')
    .all(lastSyncAt) as DBSnippet[]

  const snippetChanges: PushChangeItem<Omit<DBSnippet, 'id'>>[] = snippets.map(
    (s) => {
      const serverId = getServerId('snippets', s.id)
      const folderServerId = s.folderId
        ? getServerId('folders', s.folderId)
        : null
      return {
        serverId,
        localId: s.id,
        isNew: !serverId,
        data: {
          name: s.name,
          description: s.description,
          folderId: folderServerId,
          isDeleted: s.isDeleted,
          isFavorites: s.isFavorites,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        } as unknown as Omit<DBSnippet, 'id'>,
      }
    },
  )

  // Get changed snippet contents
  const snippetContents = db
    .prepare('SELECT * FROM snippet_contents WHERE updatedAt > ?')
    .all(lastSyncAt) as DBSnippetContent[]

  const snippetContentChanges: PushChangeItem<Omit<DBSnippetContent, 'id'>>[]
    = snippetContents.map((sc) => {
      const serverId = getServerId('snippet_contents', sc.id)
      const snippetServerId = getServerId('snippets', sc.snippetId)
      return {
        serverId,
        localId: sc.id,
        isNew: !serverId,
        data: {
          snippetId: snippetServerId,
          label: sc.label,
          value: sc.value,
          language: sc.language,
          createdAt: sc.createdAt,
          updatedAt: sc.updatedAt,
        } as unknown as Omit<DBSnippetContent, 'id'>,
      }
    })

  // Get changed tags
  const tags = db
    .prepare('SELECT * FROM tags WHERE updatedAt > ?')
    .all(lastSyncAt) as DBTag[]

  const tagChanges: PushChangeItem<Omit<DBTag, 'id'>>[] = tags.map((t) => {
    const serverId = getServerId('tags', t.id)
    return {
      serverId,
      localId: t.id,
      isNew: !serverId,
      data: {
        name: t.name,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      } as unknown as Omit<DBTag, 'id'>,
    }
  })

  // Get snippet_tags for changed snippets (we track by snippet changes)
  const snippetTagChanges: PushSnippetTagItem[] = []
  for (const snippet of snippets) {
    const snippetServerId = getServerId('snippets', snippet.id)
    if (!snippetServerId)
      continue

    const snippetTags = db
      .prepare('SELECT * FROM snippet_tags WHERE snippetId = ?')
      .all(snippet.id) as DBSnippetTag[]

    for (const st of snippetTags) {
      const tagServerId = getServerId('tags', st.tagId)
      if (tagServerId) {
        snippetTagChanges.push({
          snippetServerId,
          tagServerId,
          isNew: true,
          createdAt: snippet.updatedAt, // Use snippet's updatedAt as createdAt
        })
      }
    }
  }

  // Get unsynced deletions
  const deletions = db
    .prepare('SELECT * FROM sync_deletions WHERE synced = 0')
    .all() as DBSyncDeletion[]

  const deletionData: SyncDeletionData[] = deletions.map(d => ({
    tableName: d.tableName,
    recordId: d.serverId,
    deletedAt: d.deletedAt,
  }))

  return {
    changes: {
      folders: folderChanges as PushChangeItem<any>[],
      snippets: snippetChanges as PushChangeItem<any>[],
      snippetContents: snippetContentChanges as PushChangeItem<any>[],
      tags: tagChanges as PushChangeItem<any>[],
      snippetTags: snippetTagChanges,
    },
    deletions: deletionData,
  }
}

// Apply server changes to local database
function applyServerChanges(response: PullResponse) {
  const db = useDB()

  const transaction = db.transaction(() => {
    // Apply folder changes
    for (const folder of response.changes.folders) {
      const localId = getLocalId('folders', folder.id)
      const parentLocalId = folder.parentId
        ? getLocalId('folders', folder.parentId)
        : null

      if (localId) {
        // Update existing folder
        db.prepare(
          `
          UPDATE folders 
          SET name = ?, defaultLanguage = ?, parentId = ?, isOpen = ?, 
              orderIndex = ?, icon = ?, createdAt = ?, updatedAt = ?
          WHERE id = ?
        `,
        ).run(
          folder.name,
          folder.defaultLanguage,
          parentLocalId,
          folder.isOpen,
          folder.orderIndex,
          folder.icon,
          folder.createdAt,
          folder.updatedAt,
          localId,
        )
      }
      else {
        // Insert new folder
        const result = db
          .prepare(
            `
          INSERT INTO folders (name, defaultLanguage, parentId, isOpen, orderIndex, icon, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            folder.name,
            folder.defaultLanguage,
            parentLocalId,
            folder.isOpen,
            folder.orderIndex,
            folder.icon,
            folder.createdAt,
            folder.updatedAt,
          )
        saveIdMapping('folders', Number(result.lastInsertRowid), folder.id)
      }
    }

    // Apply tag changes
    for (const tag of response.changes.tags) {
      const localId = getLocalId('tags', tag.id)

      if (localId) {
        db.prepare(
          `
          UPDATE tags SET name = ?, createdAt = ?, updatedAt = ?
          WHERE id = ?
        `,
        ).run(tag.name, tag.createdAt, tag.updatedAt, localId)
      }
      else {
        const result = db
          .prepare(
            `
          INSERT INTO tags (name, createdAt, updatedAt) VALUES (?, ?, ?)
        `,
          )
          .run(tag.name, tag.createdAt, tag.updatedAt)
        saveIdMapping('tags', Number(result.lastInsertRowid), tag.id)
      }
    }

    // Apply snippet changes
    for (const snippet of response.changes.snippets) {
      const localId = getLocalId('snippets', snippet.id)
      const folderLocalId = snippet.folderId
        ? getLocalId('folders', snippet.folderId)
        : null

      if (localId) {
        db.prepare(
          `
          UPDATE snippets 
          SET name = ?, description = ?, folderId = ?, isDeleted = ?, 
              isFavorites = ?, createdAt = ?, updatedAt = ?
          WHERE id = ?
        `,
        ).run(
          snippet.name,
          snippet.description,
          folderLocalId,
          snippet.isDeleted,
          snippet.isFavorites,
          snippet.createdAt,
          snippet.updatedAt,
          localId,
        )
      }
      else {
        const result = db
          .prepare(
            `
          INSERT INTO snippets (name, description, folderId, isDeleted, isFavorites, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            snippet.name,
            snippet.description,
            folderLocalId,
            snippet.isDeleted,
            snippet.isFavorites,
            snippet.createdAt,
            snippet.updatedAt,
          )
        saveIdMapping('snippets', Number(result.lastInsertRowid), snippet.id)
      }
    }

    // Apply snippet content changes
    for (const content of response.changes.snippetContents) {
      const localId = getLocalId('snippet_contents', content.id)
      const snippetLocalId = getLocalId('snippets', content.snippetId)

      if (!snippetLocalId)
        continue // Skip if parent snippet not found

      if (localId) {
        db.prepare(
          `
          UPDATE snippet_contents 
          SET snippetId = ?, label = ?, value = ?, language = ?, createdAt = ?, updatedAt = ?
          WHERE id = ?
        `,
        ).run(
          snippetLocalId,
          content.label,
          content.value,
          content.language,
          content.createdAt,
          content.updatedAt,
          localId,
        )
      }
      else {
        const result = db
          .prepare(
            `
          INSERT INTO snippet_contents (snippetId, label, value, language, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            snippetLocalId,
            content.label,
            content.value,
            content.language,
            content.createdAt,
            content.updatedAt,
          )
        saveIdMapping(
          'snippet_contents',
          Number(result.lastInsertRowid),
          content.id,
        )
      }
    }

    // Apply snippet_tags changes
    for (const st of response.changes.snippetTags) {
      const snippetLocalId = getLocalId('snippets', st.snippetId)
      const tagLocalId = getLocalId('tags', st.tagId)

      if (snippetLocalId && tagLocalId) {
        db.prepare(
          `
          INSERT OR IGNORE INTO snippet_tags (snippetId, tagId) VALUES (?, ?)
        `,
        ).run(snippetLocalId, tagLocalId)
      }
    }

    // Apply deletions
    for (const deletion of response.deletions) {
      const tableName = deletion.tableName as SyncTableName
      const localId = getLocalId(tableName, deletion.recordId)

      if (localId) {
        if (tableName === 'folders') {
          db.prepare('DELETE FROM folders WHERE id = ?').run(localId)
        }
        else if (tableName === 'tags') {
          db.prepare('DELETE FROM snippet_tags WHERE tagId = ?').run(localId)
          db.prepare('DELETE FROM tags WHERE id = ?').run(localId)
        }
        else if (tableName === 'snippet_contents') {
          db.prepare('DELETE FROM snippet_contents WHERE id = ?').run(localId)
        }
        else if (tableName === 'snippets') {
          db.prepare('DELETE FROM snippet_tags WHERE snippetId = ?').run(
            localId,
          )
          db.prepare('DELETE FROM snippet_contents WHERE snippetId = ?').run(
            localId,
          )
          db.prepare('DELETE FROM snippets WHERE id = ?').run(localId)
        }
        // Remove ID mapping
        deleteIdMapping(tableName, deletion.recordId)
      }
    }
  })

  transaction()
}

// Process push response (save new ID mappings)
function processPushResponse(response: PushResponse) {
  const db = useDB()

  for (const mapping of response.idMappings) {
    saveIdMapping(mapping.tableName, mapping.localId, mapping.serverId)
  }

  // Mark deletions as synced
  db.prepare('UPDATE sync_deletions SET synced = 1 WHERE synced = 0').run()
}

// Incremental sync
export async function syncIncremental(): Promise<SyncResult> {
  try {
    const syncConfig = store.preferences.get('sync')
    const lastSyncAt = syncConfig.lastSyncAt

    // Step 1: Collect and push local changes
    const pushData = collectLocalChanges(lastSyncAt)
    const pushResponse = await syncRequest<PushResponse>(
      '/api/sync/push',
      pushData,
    )

    // Step 2: Process push response
    processPushResponse(pushResponse)

    // Step 3: Pull server changes
    const pullResponse = await syncRequest<PullResponse>('/api/sync/pull', {
      lastSyncAt,
    })

    // Step 4: Apply server changes
    applyServerChanges(pullResponse)

    // Step 5: Update last sync time
    store.preferences.set('sync.lastSyncAt', pullResponse.serverTime)

    return {
      success: true,
      message: 'Sync completed successfully',
      syncedAt: pullResponse.serverTime,
      stats: {
        pushed: {
          folders: pushData.changes.folders.length,
          snippets: pushData.changes.snippets.length,
          snippetContents: pushData.changes.snippetContents.length,
          tags: pushData.changes.tags.length,
          snippetTags: pushData.changes.snippetTags.length,
          deletions: pushData.deletions.length,
        },
        pulled: {
          folders: pullResponse.changes.folders.length,
          snippets: pullResponse.changes.snippets.length,
          snippetContents: pullResponse.changes.snippetContents.length,
          tags: pullResponse.changes.tags.length,
          snippetTags: pullResponse.changes.snippetTags.length,
          deletions: pullResponse.deletions.length,
        },
      },
    }
  }
  catch (error) {
    log('Sync failed', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: `Sync failed: ${message}`,
    }
  }
}

// Full sync (overwrite local with server data)
export async function syncFull(): Promise<SyncResult> {
  try {
    const db = useDB()

    // Get all data from server
    const response = await syncRequest<FullSyncResponse>('/api/sync/full')

    // Clear local data in transaction
    const transaction = db.transaction(() => {
      // Clear sync tables
      db.prepare('DELETE FROM sync_id_map').run()
      db.prepare('DELETE FROM sync_deletions').run()

      // Clear data tables in order (respecting foreign keys)
      db.prepare('DELETE FROM snippet_tags').run()
      db.prepare('DELETE FROM snippet_contents').run()
      db.prepare('DELETE FROM snippets').run()
      db.prepare('DELETE FROM tags').run()
      db.prepare('DELETE FROM folders').run()

      // Reset autoincrement
      db.prepare('DELETE FROM sqlite_sequence').run()
    })

    transaction()

    // Apply all server data
    applyServerChanges(response)

    // Update last sync time
    store.preferences.set('sync.lastSyncAt', response.serverTime)

    return {
      success: true,
      message: 'Full sync completed successfully',
      syncedAt: response.serverTime,
      stats: {
        pushed: {
          folders: 0,
          snippets: 0,
          snippetContents: 0,
          tags: 0,
          snippetTags: 0,
          deletions: 0,
        },
        pulled: {
          folders: response.changes.folders.length,
          snippets: response.changes.snippets.length,
          snippetContents: response.changes.snippetContents.length,
          tags: response.changes.tags.length,
          snippetTags: response.changes.snippetTags.length,
          deletions: response.deletions.length,
        },
      },
    }
  }
  catch (error) {
    log('Full sync failed', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: `Full sync failed: ${message}`,
    }
  }
}

// Record deletion for sync (call this when hard-deleting folders or tags)
export function recordDeletionForSync(
  tableName: 'folders' | 'tags' | 'snippet_contents',
  localId: number,
) {
  const serverId = getServerId(tableName, localId)
  if (serverId) {
    const db = useDB()
    db.prepare(
      `
      INSERT INTO sync_deletions (tableName, serverId, deletedAt, synced)
      VALUES (?, ?, ?, 0)
    `,
    ).run(tableName, serverId, Date.now())
  }
}

// Get sync status info
export function getSyncStatus() {
  const syncConfig = store.preferences.get('sync')
  return {
    configured: !!syncConfig.serverUrl && !!syncConfig.token,
    serverUrl: syncConfig.serverUrl,
    lastSyncAt: syncConfig.lastSyncAt,
    autoSync: syncConfig.autoSync,
    deviceId: syncConfig.deviceId,
  }
}
