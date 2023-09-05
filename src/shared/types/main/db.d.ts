import type { Language } from '@shared/types/renderer/editor'

export interface Folder {
  id: string
  name: string
  defaultLanguage: Language
  parentId: string | null
  isOpen: boolean
  isSystem: boolean
  createdAt: number
  updatedAt: number
  count: number
}

export interface FolderTree extends Folder {
  children: Folder[]
}

export type SnippetsSort = 'updatedAt' | 'createdAt' | 'name' | 'index'

export interface SnippetContent {
  label: string
  language: Language
  value: string
}

export interface Snippet {
  id: string
  name: string
  content: SnippetContent[]
  description?: string | null
  folderId: string
  tagsIds: string[]
  isFavorites: boolean
  isDeleted: boolean
  createdAt: number
  updatedAt: number
  costTime: number
  isDone: boolean
  index: number
}

export interface Tag {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface DB {
  folders: Folder[]
  snippets: Snippet[]
  tags: Tag[]
}
