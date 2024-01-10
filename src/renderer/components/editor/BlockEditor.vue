<template>
  <div ref="editor">
  </div>
</template>

<script setup lang="ts">
import '@blocksuite/presets/themes/affine.css'
import { onMounted, ref } from 'vue'
import {DocEditor, createEmptyPage} from '@blocksuite/presets'

const editorRef = ref()
const init = async () => {
  const page = await createEmptyPage().init()
  const editor = new DocEditor()
  editor.page = page

  console.log('init bEditor editorRef', editor)
  editorRef.value = editor
}

onMounted(() => {
  console.log('init bEditor')
  init()
})
</script>

<style scoped>

</style>
