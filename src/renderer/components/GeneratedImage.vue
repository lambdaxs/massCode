<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useSonner } from '@/composables'
import { i18n } from '@/electron'
import { Copy, Download } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    src: string
    assetId?: string
    downloadPrefix?: string
    imgClass?: string
    messagesPrefix?: string
  }>(),
  {
    downloadPrefix: 'image',
    imgClass: 'max-h-64 max-w-full cursor-zoom-in rounded-md object-contain',
    messagesPrefix: 'spaces.aiPrototype.image',
  },
)

const isPreviewOpen = ref(false)
const { sonner } = useSonner()

function imageMessage(key: string) {
  return i18n.t(`${props.messagesPrefix}.${key}`)
}

const downloadFileName = computed(() => {
  const assetId = props.assetId?.trim()
  if (assetId) {
    return assetId.includes('.') ? assetId : `${assetId}.png`
  }

  const mimeMatch = props.src.match(/^data:(image\/[\w+.-]+)/)
  const mimeType = mimeMatch?.[1] ?? 'image/png'
  const extension
    = mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : 'jpg'

  return `${props.downloadPrefix}-${Date.now()}.${extension}`
})

function openPreview() {
  isPreviewOpen.value = true
}

function downloadImage() {
  try {
    const anchor = document.createElement('a')
    anchor.href = props.src
    anchor.download = downloadFileName.value
    anchor.click()
  }
  catch {
    sonner({
      message: imageMessage('downloadFailed'),
      type: 'error',
    })
  }
}

async function copyImageToClipboard() {
  try {
    const response = await fetch(props.src)
    const blob = await response.blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    sonner({
      message: i18n.t('messages:success.copied'),
      type: 'success',
    })
  }
  catch {
    sonner({
      message: imageMessage('copyFailed'),
      type: 'error',
    })
  }
}
</script>

<template>
  <ContextMenu.ContextMenu>
    <ContextMenu.ContextMenuTrigger as-child>
      <button
        type="button"
        class="focus-visible:ring-ring block w-full overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:outline-hidden"
        @click="openPreview"
      >
        <img
          :src="src"
          :class="imgClass"
          alt=""
          draggable="false"
        >
      </button>
    </ContextMenu.ContextMenuTrigger>

    <ContextMenu.ContextMenuContent>
      <ContextMenu.ContextMenuItem @click="downloadImage">
        <Download />
        {{ imageMessage("download") }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuItem @click="copyImageToClipboard">
        <Copy />
        {{ imageMessage("copy") }}
      </ContextMenu.ContextMenuItem>
    </ContextMenu.ContextMenuContent>
  </ContextMenu.ContextMenu>

  <Dialog.Dialog v-model:open="isPreviewOpen">
    <Dialog.DialogContent
      class="max-w-[min(96vw,56rem)] gap-0 p-3 sm:max-w-[min(96vw,56rem)]"
    >
      <Dialog.DialogHeader class="sr-only">
        <Dialog.DialogTitle>
          {{ imageMessage("preview") }}
        </Dialog.DialogTitle>
      </Dialog.DialogHeader>

      <img
        :src="src"
        class="max-h-[85vh] w-full rounded-md object-contain"
        alt=""
        draggable="false"
      >
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
