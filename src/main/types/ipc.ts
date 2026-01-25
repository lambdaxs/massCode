import type { OpenDialogOptions } from 'electron'

export type CombineWith<T extends string, U extends string> = `${U}:${T}`

type MainMenuAction =
  | 'add-description'
  | 'copy-snippet'
  | 'find'
  | 'font-size-decrease'
  | 'font-size-increase'
  | 'font-size-reset'
  | 'format'
  | 'goto-preferences'
  | 'goto-devtools'
  | 'new-folder'
  | 'new-fragment'
  | 'new-snippet'
  | 'open-dialog'
  | 'preview-markdown'
  | 'preview-mindmap'
  | 'preview-code'
  | 'preview-json'
  | 'presentation-mode'
  | 'toggle-sidebar'

type DBAction =
  | 'relaod'
  | 'move'
  | 'migrate'
  | 'clear'
  | 'backup'
  | 'restore'
  | 'delete-backup'
  | 'backup-list'
  | 'start-auto-backup'
  | 'stop-auto-backup'
  | 'move-backup'

type SystemAction =
  | 'reload'
  | 'open-external'
  | 'deep-link'
  | 'update-available'
  | 'error'
type PrettierAction = 'format'
type FsAction = 'assets'

type SyncAction = 'get-status' | 'enable' | 'disable' | 'sync-now' | 'register'

export type MainMenuChannel = CombineWith<MainMenuAction, 'main-menu'>
export type DBChannel = CombineWith<DBAction, 'db'>
export type SystemChannel = CombineWith<SystemAction, 'system'>
export type PrettierChannel = CombineWith<PrettierAction, 'prettier'>
export type FsChannel = CombineWith<FsAction, 'fs'>
export type SyncChannel = CombineWith<SyncAction, 'sync'>

export type Channel =
  | MainMenuChannel
  | DBChannel
  | SystemChannel
  | PrettierChannel
  | FsChannel
  | SyncChannel

export interface DialogOptions {
  properties?: OpenDialogOptions['properties']
  filters?: OpenDialogOptions['filters']
}

export interface PrettierOptions {
  text: string
  parser: string
}

export interface FsAssetsOptions {
  path: string
}

export interface SyncEnableOptions {
  serverUrl: string
  userId: string
  apiKey: string
}

export interface SyncRegisterOptions {
  serverUrl: string
  email: string
}

export interface SyncStatus {
  enabled: boolean
  lastSyncTime: number | null
  serverUrl: string
  userId: string | null
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
