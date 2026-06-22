interface SyncableSelectedNote {
  id: number
  // 选中 note 完整记录加载前 content 为空
  content?: string
}

export function shouldSyncSelectedNoteContent(
  previousNote: SyncableSelectedNote | null | undefined,
  nextNote: SyncableSelectedNote | null | undefined,
): boolean {
  return (
    previousNote?.id !== nextNote?.id
    || previousNote?.content !== nextNote?.content
  )
}
