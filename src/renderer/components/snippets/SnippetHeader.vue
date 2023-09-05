<template>
  <div class="header">
    <div class="top">
      <div class="name">
        <input
          ref="inputRef"
          v-model="name"
          type="text"
          placeholder="Type snippet name"
        >
      </div>
      <div class="action">

        <AppActionButton
          v-if="snippetStore.currentLanguage === 'markdown'"
          @click="onClickMarkdownPreview"
        >
          <UniconsEye v-if="!snippetStore.isMarkdownPreview" />
          <UniconsEyeSlash v-else />
        </AppActionButton>

        <AppActionButton @click="onClickMoyu">
          <UniconsPlay v-if="!snippetStore.isTaskStart" />
          <UniconsPause v-else />
        </AppActionButton>

        <AppActionButton @click="onClickDone">
          <UniconsCheck />
        </AppActionButton>



        <AppActionButton @click="onClickScreenshotPreview">
          <UniconsCamera v-if="!snippetStore.isScreenshotPreview" />
          <UniconsCameraSlash v-else />
        </AppActionButton>

        <AppActionButton @click="onCopySnippet">
          <UniconsArrow />
        </AppActionButton>

        <AppActionButton @click="onAddDescription">
          <UniconsText />
        </AppActionButton>

        <AppActionButton @click="onAddNewFragment">
          <UniconsPlus />
        </AppActionButton>

      </div>
    </div>
    <div class="bottom">
      <SnippetsDescription v-show="snippetStore.isDescriptionShow" />
      <SnippetFragments v-if="snippetStore.isFragmentsShow" />
      <SnippetsTags
        v-if="snippetStore.isTagsShow && !snippetStore.isScreenshotPreview"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  onAddNewFragment,
  onAddDescription,
  onCopySnippet,
  StartMoyu,
  StartTask,
  StopTask,
  emitter, initStartTask,
} from '@/composable'

import { useSnippetStore } from '@/store/snippets'
import { useDebounceFn } from '@vueuse/core'
import { computed, onUnmounted, ref,onMounted } from 'vue'
import { useAppStore } from '@/store/app'
import { ipcRenderer } from "electron"
import {formatSecond} from '@/utils'
import { useFolderStore } from '@/store/folders'


// import {setInterval, clearInterval} from 'timers'



const snippetStore = useSnippetStore()
const appStore = useAppStore()
const folderStore = useFolderStore();

const inputRef = ref<HTMLInputElement>()

let timer:any = null;

const headerHeight = appStore.sizes.editor.titleHeight + 'px'

const costNumber = computed({
  get: () => snippetStore.selected?.costTime,
  set: useDebounceFn(
    v =>
      snippetStore.patchSnippetsById(snippetStore.selectedId!, { costTime: v }),
    300
  )
})

const name = computed({
  get: () => snippetStore.selected?.name,
  set: useDebounceFn(
    v =>
      snippetStore.patchSnippetsById(snippetStore.selectedId!, { name: v }),
    300
  )
})

const startTaskTimer = ()=>{

  const snippetStore = useSnippetStore()
  const title = snippetStore.selected?.name || '';
  const id = snippetStore.selected?.id || '';
  let value = costNumber?.value || 0;
  StartTask(id, title, value);

  //设置当前任务id
  snippetStore.setTaskId(snippetStore.selected?.id || '')

  return;
}

const stopTaskTimer = () => {

  //取消当前任务
  if (snippetStore.isTaskStart) {
    snippetStore.setTaskId('');
    StartMoyu('');
    StopTask();
  }
  return;
}

const onClickMarkdownPreview = () => {
  snippetStore.isMarkdownPreview = !snippetStore.isMarkdownPreview
}

const onClickScreenshotPreview = () => {
  snippetStore.isScreenshotPreview = !snippetStore.isScreenshotPreview
}

const onClickDone = async ()=>{
  const id = snippetStore.selected?.id || '';
  await snippetStore.patchSnippetsById(id, {
    isDone: true,
  })

  await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
  snippetStore.selected = snippetStore.snippets[0]

  //刷新folders
  await folderStore.getFolders();
}

const onClickMoyu = async()=>{

  console.log('123', snippetStore.isTaskStart);

  if (snippetStore.isTaskStart) {//执行任务中，可暂停

    StopTask();
    snippetStore.setTaskId('');

  }else {//未执行任务，可开始
    startTaskTimer();
    //任务置顶
    const id = snippetStore.selected?.id || '';

    await snippetStore.patchSnippetsById(id, {
      index: 999,
    })

    //刷新文档列表
    await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
    snippetStore.selected = snippetStore.snippets[0]
  }
}

emitter.on('snippet:focus-name', () => {
  inputRef.value?.select()
  console.log('focus name')
})

emitter.on('folder:click', ()=>{
  console.log('change folder')
  stopTaskTimer();
})

emitter.on('snippet:click',(id: string)=>{
  stopTaskTimer();
})

const updateFunc = async(data:any)=>{
  const {id, costTime} = data;
  await snippetStore.patchSnippetsById(id, {
    costTime: costTime,
  })
}

onMounted(()=>{
  initStartTask(updateFunc);
})

onUnmounted(() => {
  emitter.off('snippet:focus-name')
  emitter.off('folder:click')
  emitter.off('snippet:click')

  console.log('unmounted this view')
})
</script>

<style lang="scss" scoped>
.header {
  .top {
    padding: 0 var(--spacing-xs);
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: v-bind(headerHeight);
    position: relative;
    top: var(--title-bar-height-offset);
  }
  .name {
    font-size: 16px;
    width: 100%;
    input {
      border: 0;
      width: 100%;
      outline: none;
      line-height: 32px;
      text-overflow: ellipsis;
      background-color: var(--color-bg);
      color: var(--color-text);
    }
  }
  .action {
    display: flex;
  }
}
</style>
