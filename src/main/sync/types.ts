// Sync types for massCode

export interface SyncState {
  id: number
  lastSyncTimestamp: number
  userId: string | null
  apiKey: string | null
  syncEnabled: number
  serverUrl: string
}

export interface SyncFolder {
  sync_id: string
  server_version: number
  name: string
  parent_sync_id: string | null
  default_language: string | null
  is_open: boolean
  icon: string | null
  order_index: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export interface SyncSnippetContent {
  id?: number
  snippet_sync_id?: string
  label: string | null
  value: string | null
  language: string | null
}

export interface SyncSnippet {
  sync_id: string
  server_version: number
  name: string
  description: string | null
  folder_sync_id: string | null
  is_deleted: boolean
  is_favorites: boolean
  contents: SyncSnippetContent[]
  tag_sync_ids: string[]
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export interface SyncTag {
  sync_id: string
  server_version: number
  name: string
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export interface PullRequest {
  last_sync_timestamp?: number
}

export interface PullResponse {
  server_timestamp: number
  sync_id: string
  pull_data: {
    folders: SyncFolder[]
    snippets: SyncSnippet[]
    tags: SyncTag[]
  }
}

export interface PushRequest {
  folders: SyncFolder[]
  snippets: SyncSnippet[]
  tags: SyncTag[]
}

export interface PushResponse {
  success: boolean
  folders_synced: number
  snippets_synced: number
  tags_synced: number
  server_timestamp: number
}

export interface RegisterRequest {
  email: string
}

export interface RegisterResponse {
  user_id: string
  api_key: string
  email: string
  message: string
}

export interface SyncResult {
  success: boolean
  error?: string
  stats?: {
    foldersPulled: number
    snippetsPulled: number
    tagsPulled: number
    foldersPushed: number
    snippetsPushed: number
    tagsPushed: number
  }
}

export interface SyncStatus {
  enabled: boolean
  lastSyncTime: number | null
  serverUrl: string
  userId: string | null
}
