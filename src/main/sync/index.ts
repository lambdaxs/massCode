import type Database from 'better-sqlite3'
import type {
  PullRequest,
  PullResponse,
  PushRequest,
  SyncFolder,
  SyncResult,
  SyncSnippet,
  SyncSnippetContent,
  SyncStatus,
  SyncTag,
} from './types'
/**
 * Sync service for massCode
 * Handles local-first synchronization with remote server
 */
import { v4 as uuidv4 } from 'uuid'
import { useDB } from '../db'
import { log } from '../utils'
import { SyncApiClient } from './api'

export class SyncService {
  private db: Database.Database
  private apiClient: SyncApiClient | null = null

  constructor() {
    this.db = useDB()
  }

  /**
   * Get sync state from database
   */
  getSyncState(): SyncStatus {
    const row = this.db
      .prepare('SELECT * FROM sync_state WHERE id = 1')
      .get() as
      | {
        syncEnabled: number
        lastSyncTimestamp: number
        userId: string | null
        serverUrl: string
      }
      | undefined

    if (!row) {
      return {
        enabled: false,
        lastSyncTime: null,
        serverUrl: 'http://localhost:8080',
        userId: null,
      }
    }

    return {
      enabled: row.syncEnabled === 1,
      lastSyncTime: row.lastSyncTimestamp || null,
      serverUrl: row.serverUrl || 'http://localhost:8080',
      userId: row.userId,
    }
  }

  /**
   * Update sync state
   */
  private updateSyncState(
    updates: Partial<{
      lastSyncTimestamp: number
      userId: string
      apiKey: string
      syncEnabled: number
      serverUrl: string
    }>,
  ) {
    const sets = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ')
    const values = Object.values(updates)

    this.db
      .prepare(`UPDATE sync_state SET ${sets} WHERE id = 1`)
      .run(...values)
  }

  /**
   * Enable sync with credentials
   */
  enableSync(serverUrl: string, userId: string, apiKey: string): void {
    this.updateSyncState({
      serverUrl,
      userId,
      apiKey,
      syncEnabled: 1,
      lastSyncTimestamp: 0,
    })

    this.apiClient = new SyncApiClient(apiKey, serverUrl)
  }

  /**
   * Disable sync
   */
  disableSync(): void {
    this.updateSyncState({
      syncEnabled: 0,
    })
    this.apiClient = null
  }

  /**
   * Perform full synchronization
   */
  async sync(): Promise<SyncResult> {
    const state = this.getSyncState()

    if (!state.enabled || !state.userId || !state.serverUrl) {
      return {
        success: false,
        error: 'Sync is not enabled',
      }
    }

    try {
      // Initialize API client
      if (!this.apiClient) {
        const apiKey = this.db
          .prepare('SELECT apiKey FROM sync_state WHERE id = 1')
          .get() as { apiKey: string } | undefined
        if (!apiKey) {
          return { success: false, error: 'No API key found' }
        }
        this.apiClient = new SyncApiClient(apiKey.apiKey, state.serverUrl)
      }

      // Step 1: Pull changes from server
      const pullResult = await this.pullFromServer()

      // Step 2: Push local changes to server
      const pushResult = await this.pushToServer()

      // Step 3: Update sync timestamp
      const serverTimestamp = Math.max(
        pullResult.server_timestamp,
        pushResult.server_timestamp,
      )
      this.updateSyncState({ lastSyncTimestamp: serverTimestamp })

      return {
        success: true,
        stats: {
          foldersPulled: pullResult.pull_data.folders.length,
          snippetsPulled: pullResult.pull_data.snippets.length,
          tagsPulled: pullResult.pull_data.tags.length,
          foldersPushed: pushResult.folders_synced,
          snippetsPushed: pushResult.snippets_synced,
          tagsPushed: pushResult.tags_synced,
        },
      }
    }
    catch (error) {
      log('Sync failed', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Pull changes from server
   */
  private async pullFromServer(): Promise<PullResponse> {
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    const state = this.getSyncState()
    const request: PullRequest = {
      last_sync_timestamp: state.lastSyncTime ?? undefined,
    }

    const response = await this.apiClient.pull(request)

    // Merge server data into local database
    const transaction = this.db.transaction(() => {
      this.mergeFolders(response.pull_data.folders)
      this.mergeSnippets(response.pull_data.snippets)
      this.mergeTags(response.pull_data.tags)
    })

    transaction()

    return response
  }

  /**
   * Push local changes to server
   */
  private async pushToServer() {
    if (!this.apiClient) {
      throw new Error('API client not initialized')
    }

    // Collect all local data
    const request: PushRequest = {
      folders: this.getLocalFolders(),
      snippets: this.getLocalSnippets(),
      tags: this.getLocalTags(),
    }

    return await this.apiClient.push(request)
  }

  /**
   * Merge folders from server
   */
  private mergeFolders(folders: SyncFolder[]): void {
    for (const folder of folders) {
      const existing = this.db
        .prepare('SELECT * FROM folders WHERE syncId = ?')
        .get(folder.sync_id) as
        | {
          id: number
          serverVersion: number
          updatedAt: number
        }
        | undefined

      if (!existing) {
        // Insert new folder
        this.db
          .prepare(
            `
          INSERT INTO folders (
            name, defaultLanguage, parentId, isOpen, orderIndex, icon,
            createdAt, updatedAt, syncId, serverVersion, deletedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            folder.name,
            folder.default_language || 'plain_text',
            null, // parentId will be resolved later
            folder.is_open ? 1 : 0,
            folder.order_index,
            folder.icon,
            folder.created_at,
            folder.updated_at,
            folder.sync_id,
            folder.server_version,
            folder.deleted_at ?? null,
          )
      }
      else if (folder.server_version > existing.serverVersion) {
        // Update existing folder
        this.db
          .prepare(
            `
          UPDATE folders SET
            name = ?, defaultLanguage = ?, isOpen = ?, orderIndex = ?, icon = ?,
            updatedAt = ?, syncId = ?, serverVersion = ?, deletedAt = ?
          WHERE id = ?
        `,
          )
          .run(
            folder.name,
            folder.default_language || 'plain_text',
            folder.is_open ? 1 : 0,
            folder.order_index,
            folder.icon,
            folder.updated_at,
            folder.sync_id,
            folder.server_version,
            folder.deleted_at ?? null,
            existing.id,
          )
      }

      // Resolve parentId after all folders are inserted
      if (folder.parent_sync_id) {
        const parent = this.db
          .prepare('SELECT id FROM folders WHERE syncId = ?')
          .get(folder.parent_sync_id) as { id: number } | undefined
        const current = this.db
          .prepare('SELECT id FROM folders WHERE syncId = ?')
          .get(folder.sync_id) as { id: number } | undefined
        if (parent && current) {
          this.db
            .prepare('UPDATE folders SET parentId = ? WHERE id = ?')
            .run(parent.id, current.id)
        }
      }
    }
  }

  /**
   * Merge snippets from server
   */
  private mergeSnippets(snippets: SyncSnippet[]): void {
    for (const snippet of snippets) {
      const existing = this.db
        .prepare('SELECT * FROM snippets WHERE syncId = ?')
        .get(snippet.sync_id) as
        | {
          id: number
          serverVersion: number
        }
        | undefined

      let snippetId: number

      if (!existing) {
        // Insert new snippet
        const result = this.db
          .prepare(
            `
          INSERT INTO snippets (
            name, description, folderId, isDeleted, isFavorites,
            createdAt, updatedAt, syncId, serverVersion, deletedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            snippet.name,
            snippet.description ?? null,
            null, // folderId will be resolved later
            snippet.is_deleted ? 1 : 0,
            snippet.is_favorites ? 1 : 0,
            snippet.created_at,
            snippet.updated_at,
            snippet.sync_id,
            snippet.server_version,
            snippet.deleted_at ?? null,
          )
        snippetId = Number(result.lastInsertRowid)
      }
      else if (snippet.server_version > existing.serverVersion) {
        // Update existing snippet
        snippetId = existing.id
        this.db
          .prepare(
            `
          UPDATE snippets SET
            name = ?, description = ?, isDeleted = ?, isFavorites = ?,
            updatedAt = ?, syncId = ?, serverVersion = ?, deletedAt = ?
          WHERE id = ?
        `,
          )
          .run(
            snippet.name,
            snippet.description ?? null,
            snippet.is_deleted ? 1 : 0,
            snippet.is_favorites ? 1 : 0,
            snippet.updated_at,
            snippet.sync_id,
            snippet.server_version,
            snippet.deleted_at ?? null,
            existing.id,
          )

        // Delete old contents
        this.db
          .prepare('DELETE FROM snippet_contents WHERE snippetId = ?')
          .run(existing.id)
      }
      else {
        snippetId = existing.id
      }

      // Insert contents
      for (const content of snippet.contents) {
        this.db
          .prepare(
            `
          INSERT INTO snippet_contents (snippetId, label, value, language)
          VALUES (?, ?, ?, ?)
        `,
          )
          .run(
            snippetId,
            content.label ?? null,
            content.value ?? null,
            content.language ?? null,
          )
      }

      // Resolve folderId
      if (snippet.folder_sync_id) {
        const folder = this.db
          .prepare('SELECT id FROM folders WHERE syncId = ?')
          .get(snippet.folder_sync_id) as { id: number } | undefined
        if (folder) {
          this.db
            .prepare('UPDATE snippets SET folderId = ? WHERE id = ?')
            .run(folder.id, snippetId)
        }
      }

      // Handle tags
      const current = this.db
        .prepare('SELECT id FROM snippets WHERE syncId = ?')
        .get(snippet.sync_id) as { id: number }
      this.db
        .prepare('DELETE FROM snippet_tags WHERE snippetId = ?')
        .run(current.id)

      for (const tagSyncId of snippet.tag_sync_ids) {
        const tag = this.db
          .prepare('SELECT id FROM tags WHERE syncId = ?')
          .get(tagSyncId) as { id: number } | undefined
        if (tag) {
          this.db
            .prepare(
              'INSERT OR IGNORE INTO snippet_tags (snippetId, tagId) VALUES (?, ?)',
            )
            .run(current.id, tag.id)
        }
      }
    }
  }

  /**
   * Merge tags from server
   */
  private mergeTags(tags: SyncTag[]): void {
    for (const tag of tags) {
      const existing = this.db
        .prepare('SELECT * FROM tags WHERE syncId = ?')
        .get(tag.sync_id) as
        | {
          id: number
          serverVersion: number
        }
        | undefined

      if (!existing) {
        // Insert new tag
        this.db
          .prepare(
            `
          INSERT INTO tags (name, createdAt, updatedAt, syncId, serverVersion, deletedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            tag.name,
            tag.created_at,
            tag.updated_at,
            tag.sync_id,
            tag.server_version,
            tag.deleted_at ?? null,
          )
      }
      else if (tag.server_version > existing.serverVersion) {
        // Update existing tag
        this.db
          .prepare(
            `
          UPDATE tags SET
            name = ?, updatedAt = ?, syncId = ?, serverVersion = ?, deletedAt = ?
          WHERE id = ?
        `,
          )
          .run(
            tag.name,
            tag.updated_at,
            tag.sync_id,
            tag.server_version,
            tag.deleted_at ?? null,
            existing.id,
          )
      }
    }
  }

  /**
   * Get local folders for push
   */
  private getLocalFolders(): SyncFolder[] {
    const rows = this.db
      .prepare(
        `
      SELECT
        id, name, defaultLanguage as default_language, parentId, isOpen as is_open,
        orderIndex as order_index, icon, createdAt as created_at, updatedAt as updated_at,
        syncId as sync_id, serverVersion as server_version, deletedAt as deleted_at
      FROM folders
    `,
      )
      .all() as Array<{
      id: number
      name: string
      default_language: string
      parentId: number | null
      is_open: number
      order_index: number
      icon: string | null
      created_at: number
      updated_at: number
      sync_id: string | null
      server_version: number
      deleted_at: number | null
    }>

    return rows.map(row => ({
      sync_id: row.sync_id || uuidv4(),
      server_version: row.server_version,
      name: row.name,
      parent_sync_id: null, // Will be resolved
      default_language: row.default_language,
      is_open: row.is_open === 1,
      icon: row.icon,
      order_index: row.order_index,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }))
  }

  /**
   * Get local snippets for push
   */
  private getLocalSnippets(): SyncSnippet[] {
    const rows = this.db
      .prepare(
        `
      SELECT
        s.id, s.name, s.description, s.folderId, s.isDeleted as is_deleted,
        s.isFavorites as is_favorites, s.createdAt as created_at, s.updatedAt as updated_at,
        s.syncId as sync_id, s.serverVersion as server_version, s.deletedAt as deleted_at
      FROM snippets s
    `,
      )
      .all() as Array<{
      id: number
      name: string
      description: string | null
      folderId: number | null
      is_deleted: number
      is_favorites: number
      created_at: number
      updated_at: number
      sync_id: string | null
      server_version: number
      deleted_at: number | null
    }>

    return rows.map((row) => {
      // Get contents
      const contents = this.db
        .prepare(
          'SELECT label, value, language FROM snippet_contents WHERE snippetId = ?',
        )
        .all(row.id) as SyncSnippetContent[]

      // Get tags
      const tagRows = this.db
        .prepare(
          `
        SELECT t.syncId
        FROM tags t
        JOIN snippet_tags st ON t.id = st.tagId
        WHERE st.snippetId = ?
      `,
        )
        .all(row.id) as Array<{ syncId: string }>

      return {
        sync_id: row.sync_id || uuidv4(),
        server_version: row.server_version,
        name: row.name,
        description: row.description,
        folder_sync_id: null, // Will be resolved
        is_deleted: row.is_deleted === 1,
        is_favorites: row.is_favorites === 1,
        contents,
        tag_sync_ids: tagRows.map(t => t.syncId),
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
      }
    })
  }

  /**
   * Get local tags for push
   */
  private getLocalTags(): SyncTag[] {
    const rows = this.db
      .prepare(
        `
      SELECT
        id, name, createdAt as created_at, updatedAt as updated_at,
        syncId as sync_id, serverVersion as server_version, deletedAt as deleted_at
      FROM tags
    `,
      )
      .all() as Array<{
      id: number
      name: string
      created_at: number
      updated_at: number
      sync_id: string | null
      server_version: number
      deleted_at: number | null
    }>

    return rows.map(row => ({
      sync_id: row.sync_id || uuidv4(),
      server_version: row.server_version,
      name: row.name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }))
  }

  /**
   * Generate sync ID for a new entity
   */
  static generateSyncId(): string {
    return uuidv4()
  }
}
