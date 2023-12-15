<template>
  <div class="editor">
    <div @paste="handlePaste">
      <div
        ref="editorRef"
        class="main"
      />
    </div>
    <div class="footer">
      <span>
        <select
          v-model="localLang"
          class="lang-selector"
        >
          <option
            v-for="i in languages"
            :key="i.value"
            :value="i.value"
          >
            {{ i.name }}
          </option>
        </select>
      </span>
      <span>
        {{ snippetStore.selected?.costTime?`任务耗时:${formatSecond(snippetStore.selected?.costTime)}`:'' }}
      </span>
      <span>
        Line {{ cursorPosition.row + 1 }}, Column
        {{ cursorPosition.column + 1 }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { Ace } from 'ace-builds'
import ace from 'ace-builds'
import './module-resolver'
import type { Language } from '@shared/types/renderer/editor'
import { languages } from './languages'
import { useAppStore } from '@/store/app'
import { useSnippetStore } from '@/store/snippets'
import { ipc, track } from '@/electron'
import { emitter } from '@/composable'
import { useFolderStore } from '@/store/folders'
import { formatSecond } from '@/utils'
import axios from 'axios'

interface Props {
  lang: Language
  fragments: boolean
  fragmentIndex: number
  snippetId: string
  modelValue: string
  isSearchMode: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'update:lang', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  lang: 'markdown'
})

const emit = defineEmits<Emits>()

const appStore = useAppStore()
const snippetStore = useSnippetStore()
const folderStore = useFolderStore()

const editorRef = ref()
const cursorPosition = reactive({
  row: 0,
  column: 0
})
let editor: Ace.Editor

const localLang = computed({
  get: () => props.lang,
  set: v => emit('update:lang', v)
})

const forceRefresh = ref()

const editorHeight = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  forceRefresh.value

  let result =
    appStore.sizes.editor.titleHeight +
    appStore.sizes.titlebar +
    appStore.sizes.editor.footerHeight

  if (snippetStore.isFragmentsShow) {
    result += appStore.sizes.editor.fragmentsHeight
  }

  if (snippetStore.isTagsShow) {
    result += appStore.sizes.editor.tagsHeight
  }

  if (snippetStore.isDescriptionShow) {
    result += appStore.sizes.editor.descriptionHeight
  }

  return window.innerHeight - result + 'px'
})

const footerHeight = computed(() => appStore.sizes.editor.footerHeight + 'px')

const handlePaste = (event: ClipboardEvent) => {
  console.log('123')
  // 阻止默认粘贴行为
  event.preventDefault()
  // 获取粘贴的内容
  const items = (event.clipboardData || event.originalEvent.clipboardData).items
  // 遍历粘贴的内容
  for (const index in items) {
    const item = items[index]
    // 判断是否是图片
    if (item.kind === 'file' && item.type.includes('image')) {
      const blob = item.getAsFile()
      // 处理粘贴的图片
      handlePastedImage(blob)
    }
  }
}

const readFileAsBinaryString = (file: File) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result)
    }
    reader.readAsBinaryString(file)
  })
}

const handlePastedImage = async (img: File) => {

  // const imageTypes = img.type.split('/')
  // let imageType = ''
  // if (imageTypes.length === 2) {
  //   imageType = imageTypes[1]
  // }
  //
  // console.log(img.type, imageTypes, imageTypes.length, imageType)
  // const blobData = await readFileAsBinaryString(img)
  // // 上传图片
  // axios.post('http://127.0.0.1:8090/upload', blobData, {
  //   headers: {
  //     'Content-Type': 'application/octet-stream',
  //     'X-IMAGE-TYPE': imageType
  //   }
  // }).then(rs => {
  //   const { data } = rs
  //   const imageUrl = `![image](http://127.0.0.1:8090/${data})`
  //   editor.getSession().insert(editor.getSession().getSelection().getCursor(), imageUrl)
  //   console.log(rs)
  // }).catch(e => {
  //   console.log(e)
  // })
  // // 插入图片连接
  // console.log('===========', img)


  const formData = new FormData()
  formData.append('image', img)
  axios.post('http://127.0.0.1:8091/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }).then(rs => {
      console.log('111111', rs)
      const { data } = rs
      const imageUrl = `![image](http://127.0.0.1:8091/${data})`
      editor.getSession().insert(editor.getSession().getSelection().getCursor(), imageUrl)
  })
}

const init = async () => {
  editor = ace.edit(editorRef.value, {
    theme: `ace/theme/${appStore.editor.theme}`,
    useWorker: false,
    fontSize: appStore.editor.fontSize,
    fontFamily: appStore.editor.fontFamily,
    printMargin: false,
    tabSize: appStore.editor.tabSize,
    wrap: appStore.editor.wrap,
    showInvisibles: appStore.editor.showInvisibles,
    highlightGutterLine: appStore.editor.highlightGutter,
    highlightActiveLine: appStore.editor.highlightLine,
    autoScrollEditorIntoView: true
  })

  setValue()
  setLang()

  // Удаляем некторые шорткаты
  // @ts-ignore
  // editor.commands.removeCommand('find')
  // editor.commands.removeCommand('gotoline')
  editor.commands.removeCommand('showSettingsMenu')

  // События
  editor.on('change', () => {
    emit('update:modelValue', editor.getValue())
  })
  editor.selection.on('changeCursor', () => {
    getCursorPosition()
  })
  editor.on('focus', async () => {
    if (snippetStore.searchQuery?.length) {
      snippetStore.searchQuery = undefined
      folderStore.selectId(snippetStore.selected!.folderId)
      await snippetStore.setSnippetsByFolderIds()
      emitter.emit('scroll-to:snippet', snippetStore.selectedId!)
    }
  })

  // editor.on('paste', (value) => {
  //   // 粘贴图片
  // })

  // Фиксированный размер для колонки чисел строк
  // @ts-ignore
  editor.session.gutterRenderer = {
    getWidth: () => 20,
    getText: (session: any, row: number) => {
      return row + 1
    }
  }
}

const setValue = () => {
  const pos = editor.session.selection.toJSON()
  editor.setValue(props.modelValue)
  editor.session.selection.fromJSON(pos)

  if (snippetStore.searchQuery) {
    findAll(snippetStore.searchQuery)
  }
}

const pasteImage = async () => {
  console.log('paste Image')
}

const format = async () => {
  // format json
  const r = editor.getSession().getSelection().getRange()
  const t = editor.getSession().getTextRange(r)
  const n = JSON.stringify(JSON.parse(t), null, 2)
  editor.getSession().replace(r, n)
  return
  // todo other format
  const availableLang: Language[] = [
    'css',
    'dockerfile',
    'gitignore',
    'graphqlschema',
    'html',
    'ini',
    'jade',
    'java',
    'javascript',
    'json',
    'json5',
    'less',
    'markdown',
    'php',
    'properties',
    'sass',
    'scss',
    'sh',
    'toml',
    'typescript',
    'xml',
    'yaml'
  ]

  if (!availableLang.includes(props.lang)) return

  let parser = props.lang as string
  const shellLike = ['dockerfile', 'gitignore', 'properties', 'ini']

  if (props.lang === 'javascript') parser = 'babel'
  if (props.lang === 'graphqlschema') parser = 'graphql'
  if (props.lang === 'jade') parser = 'pug'
  if (shellLike.includes(props.lang)) parser = 'sh'

  try {
    const formatted = await ipc.invoke('main:prettier', {
      source: props.modelValue,
      parser
    })
    await snippetStore.patchCurrentSnippetContentByKey('value', formatted)
    setValue()
    track('snippets/format')
  } catch (err) {
    console.error(err)
  }
}

const setLang = () => {
  editor.session.setMode(`ace/mode/${localLang.value}`)
  track('snippets/set-language', localLang.value)
}

const resetUndoStack = () => {
  editor.getSession().setUndoManager(new ace.UndoManager())
}

const setCursorToStartAndClearSelection = () => {
  editor.moveCursorTo(0, 0)
  editor.clearSelection()
}

const findAll = (q: string) => {
  if (q === '') return

  const prevMarks = editor.session.getMarkers()

  if (prevMarks) {
    for (const i of Object.keys(prevMarks)) {
      editor.session.removeMarker(prevMarks[Number(i)].id)
    }
  }

  editor.findAll(q, { caseSensitive: false, preventScroll: true })
}

const getCursorPosition = () => {
  const { row, column } = editor.getCursorPosition()
  cursorPosition.row = row
  cursorPosition.column = column
}

onMounted(() => {
  init()
})

watch(
  () => props.lang,
  () => setLang()
)

watch(
  () => [props.snippetId, props.fragmentIndex].concat(),
  () => setValue()
)

watch(
  () => snippetStore.searchQuery,
  v => {
    if (v) findAll(v)
  }
)

watch(
  () => [props.snippetId, props.fragmentIndex],
  () => {
    resetUndoStack()
    if (!props.isSearchMode) {
      setCursorToStartAndClearSelection()
    }
  }
)

emitter.on('snippet:format', () => format())

emitter.on('snippet:paste-image', () => pasteImage())

onUnmounted(() => {
  emitter.off('snippet:format')
  emitter.off('snippet:paste-image')
})


window.addEventListener('resize', () => {
  forceRefresh.value = Math.random()
})
</script>

<style lang="scss" scoped>
.editor {
  padding-top: 4px;
  .main {
    height: v-bind(editorHeight);
  }
  .footer {
    height: v-bind(footerHeight);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--spacing-xs);
    font-size: 12px;
    select {
      background-color: var(--color-bg);
    }
  }
}
.lang-selector {
  -webkit-appearance: none;
  border: 0;
  outline: none;
  color: var(--color-text);
}
</style>
