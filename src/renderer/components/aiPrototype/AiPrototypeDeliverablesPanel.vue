<script setup lang="ts">
import type { AiPrototypeDeliverable } from '~/shared/aiPrototype'
import { useCopyToClipboard, useSonner } from '@/composables'
import { useAiPrototype } from '@/composables/spaces/aiPrototype/useAiPrototype'
import { i18n } from '@/electron'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Image,
  Upload,
  UploadCloud,
} from 'lucide-vue-next'

const {
  deliverables,
  activeSessionId,
  getDeliverableContent,
  exportDeliverable,
  exportAllDeliverables,
  getAssetDataUrl,
  isExporting,
} = useAiPrototype()

const copy = useCopyToClipboard()
const { sonner } = useSonner()

const expanded = ref(true)
const previewId = ref<string | null>(null)
const previewContent = ref('')
const previewImageUrl = ref('')
const isExportDialogOpen = ref(false)
const exportDeliverableId = ref<string | null>(null)
const exportAll = ref(false)

const previewedDeliverable = computed(() => {
  if (!previewId.value) {
    return null
  }

  return deliverables.value.find(item => item.id === previewId.value) ?? null
})

async function refreshPreviewContent() {
  const item = previewedDeliverable.value
  if (!item) {
    previewContent.value = ''
    previewImageUrl.value = ''
    return
  }

  if (item.kind === 'markdown') {
    previewContent.value = (await getDeliverableContent(item.id)) ?? ''
    previewImageUrl.value = ''
    return
  }

  previewContent.value = ''
  previewImageUrl.value
    = (await getAssetDataUrl(item.id, 'outputs', item.updatedAt)) ?? ''
}

watch(
  () => previewedDeliverable.value?.updatedAt,
  (updatedAt) => {
    if (!updatedAt || !previewId.value) {
      return
    }

    void refreshPreviewContent()
  },
)

watch(activeSessionId, () => {
  previewId.value = null
  previewContent.value = ''
  previewImageUrl.value = ''
})

watch(previewedDeliverable, (item) => {
  if (previewId.value && !item) {
    previewId.value = null
    previewContent.value = ''
    previewImageUrl.value = ''
  }
})

async function onPreview(item: AiPrototypeDeliverable) {
  if (previewId.value === item.id) {
    previewId.value = null
    previewContent.value = ''
    previewImageUrl.value = ''
    return
  }

  previewId.value = item.id
  await refreshPreviewContent()
}

async function onCopy(item: AiPrototypeDeliverable) {
  if (item.kind === 'markdown') {
    const content = await getDeliverableContent(item.id)
    if (content) {
      copy(content)
    }
    return
  }

  const url = await getAssetDataUrl(item.id, 'outputs', item.updatedAt)
  if (url) {
    copy(url)
  }
}

function onExport(item: AiPrototypeDeliverable) {
  exportAll.value = false
  exportDeliverableId.value = item.id
  isExportDialogOpen.value = true
}

function onExportAll() {
  exportAll.value = true
  exportDeliverableId.value = null
  isExportDialogOpen.value = true
}

async function onExportConfirm(folderId: number | null) {
  try {
    if (exportAll.value) {
      const result = await exportAllDeliverables(folderId)
      if (!result?.notes.length) {
        return
      }

      isExportDialogOpen.value = false
      sonner({
        message: i18n.t('spaces.aiPrototype.export.allSuccess', {
          count: result.notes.length,
        }),
        type: 'success',
      })
      return
    }

    if (!exportDeliverableId.value) {
      return
    }

    const result = await exportDeliverable(exportDeliverableId.value, folderId)
    if (!result) {
      return
    }

    isExportDialogOpen.value = false
    sonner({
      message: i18n.t('spaces.aiPrototype.export.success', {
        name: result.noteName,
      }),
      type: 'success',
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const knownKey = `spaces.aiPrototype.errors.${message}`
    sonner({
      message: i18n.t(knownKey) !== knownKey ? i18n.t(knownKey) : message,
      type: 'error',
    })
  }
}
</script>

<template>
  <div class="border-border bg-muted/20 rounded-xl border">
    <div class="flex items-center gap-1 px-2 py-2">
      <button
        type="button"
        class="hover:bg-accent flex min-w-0 flex-1 items-center justify-between rounded-md px-1 py-0.5 text-left"
        @click="expanded = !expanded"
      >
        <span class="inline-flex items-center gap-2 text-xs font-medium">
          <FileText class="h-3.5 w-3.5" />
          {{ i18n.t("spaces.aiPrototype.deliverables") }}
          <span class="text-muted-foreground">({{ deliverables.length }})</span>
        </span>
        <component
          :is="expanded ? ChevronUp : ChevronDown"
          class="text-muted-foreground h-3.5 w-3.5"
        />
      </button>
      <UiActionButton
        v-if="deliverables.length"
        :tooltip="i18n.t('spaces.aiPrototype.export.allAction')"
        :disabled="isExporting"
        @click="onExportAll"
      >
        <UploadCloud class="h-3.5 w-3.5" />
      </UiActionButton>
    </div>

    <div
      v-if="expanded"
      class="border-border space-y-1 border-t px-2 py-2"
    >
      <div
        v-if="!deliverables.length"
        class="text-muted-foreground px-1 py-2 text-xs"
      >
        {{ i18n.t("spaces.aiPrototype.noDeliverables") }}
      </div>

      <div
        v-for="item in deliverables"
        :key="item.id"
        class="rounded-lg px-1 py-1"
      >
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="hover:bg-accent min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs"
            @click="onPreview(item)"
          >
            <component
              :is="item.kind === 'image' ? Image : FileText"
              class="mr-1 inline h-3 w-3"
            />
            {{ item.name }}
          </button>
          <UiActionButton
            v-if="item.kind === 'markdown'"
            :tooltip="i18n.t('button.copy')"
            @click="onCopy(item)"
          >
            <Copy class="h-3.5 w-3.5" />
          </UiActionButton>
          <UiActionButton
            :tooltip="i18n.t('spaces.aiPrototype.export.action')"
            :disabled="isExporting"
            @click="onExport(item)"
          >
            <Upload class="h-3.5 w-3.5" />
          </UiActionButton>
        </div>

        <pre
          v-if="previewId === item.id && previewContent"
          class="bg-background scrollbar mt-1 max-h-48 overflow-auto rounded-md p-2 text-[11px] leading-relaxed whitespace-pre-wrap"
        >{{ previewContent }}</pre>
        <img
          v-if="previewId === item.id && previewImageUrl"
          :src="previewImageUrl"
          class="mt-1 max-h-48 rounded-md object-contain"
          alt=""
        >
      </div>
    </div>
  </div>

  <AiPrototypeExportDialog
    v-model:open="isExportDialogOpen"
    :title="
      exportAll ? i18n.t('spaces.aiPrototype.export.allTitle') : undefined
    "
    :description="
      exportAll
        ? i18n.t('spaces.aiPrototype.export.allDescription', {
          count: deliverables.length,
        })
        : undefined
    "
    @confirm="onExportConfirm"
  />
</template>
