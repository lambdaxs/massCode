import { createFetch, useClipboard } from '@vueuse/core'
import mitt from 'mitt'
import type { EmitterEvents } from '@shared/types/renderer/composable'
import { API_PORT } from '../../main/config'
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'
import { ipc, track } from '@/electron'
import type { NotificationRequest } from '@shared/types/main'
import type { Snippet, SnippetsSort } from '@shared/types/main/db'

export const useApi = createFetch({
  baseUrl: `http://localhost:${API_PORT}`
})

export const emitter = mitt<EmitterEvents>()

export const onAddNewSnippet = async () => {
  const folderStore = useFolderStore()
  const snippetStore = useSnippetStore()

  await snippetStore.addNewSnippet()

  if (folderStore.selectedId) {
    await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
  } else {
    snippetStore.setSnippetsByAlias('inbox')
  }

  emitter.emit('snippet:focus-name', true)
  track('snippets/add-new')
}

export const onCreateSnippet = async (body: Partial<Snippet>) => {
  const snippetStore = useSnippetStore()

  await snippetStore.addNewSnippet(body)
  await snippetStore.getSnippets()
  snippetStore.setSnippetsByAlias('inbox')
  track('api/snippet-create')
}

export const onAddNewFragment = async () => {
  const snippetStore = useSnippetStore()

  await snippetStore.addNewFragmentToSnippetsById(snippetStore.selectedId!)
  track('snippets/add-fragment')
}

export const onAddDescription = async () => {
  const snippetStore = useSnippetStore()

  if (typeof snippetStore.selected?.description === 'string') return

  if (
    snippetStore.selected?.description === undefined ||
    snippetStore.selected?.description === null
  ) {
    await snippetStore.patchSnippetsById(snippetStore.selectedId!, {
      description: ''
    })
  }

  track('snippets/add-description')
}

export const onAddNewFolder = async () => {
  const folderStore = useFolderStore()
  const snippetStore = useSnippetStore()

  const folder = await folderStore.addNewFolder()
  snippetStore.selected = undefined

  emitter.emit('scroll-to:folder', folder.id)
  track('folders/add-new')
}

export const onCopySnippet = () => {
  const snippetStore = useSnippetStore()

  const { copy } = useClipboard({ source: snippetStore.currentContent })
  copy()

  ipc.invoke<any, NotificationRequest>('main:notification', {
    body: 'Snippet copied'
  })
  track('snippets/copy')
}

export const StartMoyu = (title:string)=>{
  ipc.invoke(`tab:startMoyu`, title)
}

//监听定时器回调
export const initStartTask = (updateFunc:any)=>{
  ipc.on('tab:updateCostTime',(event, args)=>{
    console.log(event, args);
    updateFunc(args);
  })
}

//开启定时任务
export const StartTask = (id:string, title:string, costTime: number)=>{
  ipc.invoke(`tab:startTask`, {
    id,
    title,
    costTime,
  })
}

//停止定时任务
export const StopTask = () =>{
  ipc.invoke(`tab:stopTask`, "")
}

export const setScrollPosition = (el: HTMLElement, offset: number) => {
  const ps = el.querySelector('.ps')
  if (ps) ps.scrollTop = offset
}

export const sortSnippetsBy = (snippets: Snippet[], sort: SnippetsSort) => {
  if (snippets === null) {
    snippets = []
  }

  if (sort === 'updatedAt') {
    snippets.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
  }

  if (sort === 'createdAt') {
    snippets.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
  }

  if (sort === 'name') {
    snippets.sort((a, b) =>
      a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
    )
  }

  if (sort === 'index') {
    snippets.sort((a, b) => (a.index > b.index ? -1 : 1))
  }
}

export const useHljsTheme = async (theme: 'dark' | 'light') => {
  const { default: darkCSS } = await import(
    'highlight.js/styles/base16/material.css?raw'
  )
  const { default: lightCSS } = await import(
    'highlight.js/styles/github.css?raw'
  )

  document.querySelector('[data=hljs-theme]')?.remove()

  const style = document.createElement('style')
  style.setAttribute('data', 'hljs-theme')

  if (theme === 'dark') {
    style.innerHTML = darkCSS
  } else {
    style.innerHTML = lightCSS
  }

  document.head.appendChild(style)
}
