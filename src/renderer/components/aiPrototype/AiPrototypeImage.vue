<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useSonner } from '@/composables'
import { i18n } from '@/electron'
import { Copy, Download } from 'lucide-vue-next'

const props = defineProps<{
  src: string
  assetId?: string
}>()

const isPreviewOpen = ref(false)
const { sonner } = useSonner()

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

  return `prototype-${Date.now()}.${extension}`
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
      message: i18n.t('spaces.aiPrototype.image.downloadFailed'),
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
      message: i18n.t('spaces.aiPrototype.image.copyFailed'),
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
        class="focus-visible:ring-ring block overflow-hidden rounded-md focus-visible:ring-2 focus-visible:outline-hidden"
        @click="openPreview"
      >
        <img
          :src="src"
          class="max-h-64 max-w-full cursor-zoom-in rounded-md object-contain"
          alt=""
          draggable="false"
        >
      </button>
    </ContextMenu.ContextMenuTrigger>

    <ContextMenu.ContextMenuContent>
      <ContextMenu.ContextMenuItem @click="downloadImage">
        <Download />
        {{ i18n.t("spaces.aiPrototype.image.download") }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuItem @click="copyImageToClipboard">
        <Copy />
        {{ i18n.t("spaces.aiPrototype.image.copy") }}
      </ContextMenu.ContextMenuItem>
    </ContextMenu.ContextMenuContent>
  </ContextMenu.ContextMenu>

  <Dialog.Dialog v-model:open="isPreviewOpen">
    <Dialog.DialogContent
      class="max-w-[min(96vw,56rem)] gap-0 p-3 sm:max-w-[min(96vw,56rem)]"
    >
      <Dialog.DialogHeader class="sr-only">
        <Dialog.DialogTitle>
          {{ i18n.t("spaces.aiPrototype.image.preview") }}
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
