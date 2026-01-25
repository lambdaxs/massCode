// Sync service type definitions

// Database record types (from SQLite)
export interface DBFolder {
  id: number
  name: string
  defaultLanguage: string
  parentId: number | null
  isOpen: number
  orderIndex: number
  icon: string | null
  createdAt: number
  updatedAt: number
}

export interface DBSnippet {
  id: number
  name: string
  description: string | null
  folderId: number | null
  isDeleted: number
  isFavorites: number
  createdAt: number
  updatedAt: number
}

export interface DBSnippetContent {
  id: number
  snippetId: number
  label: string | null
  value: string | null
  language: string | null
  createdAt: number
  updatedAt: number
}

export interface DBTag {
  id: number
  name: string
  createdAt: number
  updatedAt: number
}

export interface DBSnippetTag {
  snippetId: number
  tagId: number
}

export interface DBSyncIdMap {
  id: number
  tableName: string
  localId: number
  serverId: string
}

export interface DBSyncDeletion {
  id: number
  tableName: string
  serverId: string
  deletedAt: number
  synced: number
}

// Sync API types
export type SyncTableName =
  | 'folders'
  | 'snippets'
  | 'snippet_contents'
  | 'tags'

export interface SyncFolderData {
  id: string
  name: string
  defaultLanguage: string
  parentId: string | null
  isOpen: number
  orderIndex: number
  icon: string | null
  createdAt: number
  updatedAt: number
}

export interface SyncSnippetData {
  id: string
  name: string
  description: string | null
  folderId: string | null
  isDeleted: number
  isFavorites: number
  createdAt: number
  updatedAt: number
}

export interface SyncSnippetContentData {
  id: string
  snippetId: string
  label: string | null
  value: string | null
  language: string | null
  createdAt: number
  updatedAt: number
}

export interface SyncTagData {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface SyncSnippetTagData {
  snippetId: string
  tagId: string
  createdAt: number
}

export interface SyncDeletionData {
  tableName: string
  recordId: string
  deletedAt: number
}

// Push request types
export interface PushChangeItem<T> {
  serverId: string | null
  localId: number
  data: T
  isNew: boolean
}

export interface PushSnippetTagItem {
  snippetServerId: string
  tagServerId: string
  isNew: boolean
  createdAt: number
}

export interface PushRequest {
  changes: {
    folders: PushChangeItem<Omit<SyncFolderData, 'id'>>[]
    snippets: PushChangeItem<Omit<SyncSnippetData, 'id'>>[]
    snippetContents: PushChangeItem<Omit<SyncSnippetContentData, 'id'>>[]
    tags: PushChangeItem<Omit<SyncTagData, 'id'>>[]
    snippetTags: PushSnippetTagItem[]
  }
  deletions: SyncDeletionData[]
}

export interface PushResponse {
  serverTime: number
  idMappings: {
    tableName: SyncTableName
    localId: number
    serverId: string
  }[]
}

// Pull request/response types
export interface PullRequest {
  lastSyncAt: number
}

export interface PullResponse {
  serverTime: number
  changes: {
    folders: SyncFolderData[]
    snippets: SyncSnippetData[]
    snippetContents: SyncSnippetContentData[]
    tags: SyncTagData[]
    snippetTags: SyncSnippetTagData[]
  }
  deletions: SyncDeletionData[]
}

// Full sync response (same as pull but includes all data)
export type FullSyncResponse = PullResponse

// Sync result type
export interface SyncResult {
  success: boolean
  message: string
  syncedAt?: number
  stats?: {
    pushed: {
      folders: number
      snippets: number
      snippetContents: number
      tags: number
      snippetTags: number
      deletions: number
    }
    pulled: {
      folders: number
      snippets: number
      snippetContents: number
      tags: number
      snippetTags: number
      deletions: number
    }
  }
}

// Test connection response
export interface TestConnectionResponse {
  success: boolean
  message: string
  serverTime?: number
}
