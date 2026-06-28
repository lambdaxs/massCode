<script setup lang="ts">
import type { AiOperationsDeliverable } from '~/shared/aiOperations'
import { useCopyToClipboard, useSonner } from '@/composables'
import { useAiOperations } from '@/composables/spaces/aiOperations/useAiOperations'
import { i18n } from '@/electron'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Upload,
  UploadCloud,
} from 'lucide-vue-next'

const {
  deliverables,
  activeSessionId,
  getDeliverableContent,
  exportDeliverable,
  exportAllDeliverables,
  isExporting,
} = useAiOperations()

const copy = useCopyToClipboard()
const { sonner } = useSonner()

const expanded = ref(true)
const previewFileName = ref<string | null>(null)
const previewContent = ref('')
const isExportDialogOpen = ref(false)
const exportFileName = ref<string | null>(null)
const exportAll = ref(false)

const previewedDeliverable = computed(() => {
  if (!previewFileName.value) {
    return null
  }

  return (
    deliverables.value.find(
      item => item.fileName === previewFileName.value,
    ) ?? null
  )
})

async function refreshPreviewContent() {
  if (!previewFileName.value) {
    previewContent.value = ''
    return
  }

  previewContent.value
    = (await getDeliverableContent(previewFileName.value)) ?? ''
}

watch(
  () => previewedDeliverable.value?.updatedAt,
  (updatedAt) => {
    if (!updatedAt || !previewFileName.value) {
      return
    }

    void refreshPreviewContent()
  },
)

watch(activeSessionId, () => {
  previewFileName.value = null
  previewContent.value = ''
})

watch(previewedDeliverable, (item) => {
  if (previewFileName.value && !item) {
    previewFileName.value = null
    previewContent.value = ''
  }
})

async function onPreview(item: AiOperationsDeliverable) {
  if (previewFileName.value === item.fileName) {
    previewFileName.value = null
    previewContent.value = ''
    return
  }

  previewFileName.value = item.fileName
  await refreshPreviewContent()
}

async function onCopy(item: AiOperationsDeliverable) {
  const content = await getDeliverableContent(item.fileName)
  if (!content) {
    return
  }

  copy(content)
}

function onExport(item: AiOperationsDeliverable) {
  exportAll.value = false
  exportFileName.value = item.fileName
  isExportDialogOpen.value = true
}

function onExportAll() {
  exportAll.value = true
  exportFileName.value = null
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
        message: i18n.t('spaces.aiOperations.export.allSuccess', {
          count: result.notes.length,
        }),
        type: 'success',
      })
      return
    }

    if (!exportFileName.value) {
      return
    }

    const result = await exportDeliverable(exportFileName.value, folderId)
    if (!result) {
      return
    }

    isExportDialogOpen.value = false
    sonner({
      message: i18n.t('spaces.aiOperations.export.success', {
        name: result.noteName,
      }),
      type: 'success',
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const knownKey = `spaces.aiOperations.errors.${message}`
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
          {{ i18n.t("spaces.aiOperations.deliverables") }}
          <span class="text-muted-foreground">({{ deliverables.length }})</span>
        </span>
        <component
          :is="expanded ? ChevronUp : ChevronDown"
          class="text-muted-foreground h-3.5 w-3.5"
        />
      </button>
      <UiActionButton
        v-if="deliverables.length"
        :tooltip="i18n.t('spaces.aiOperations.export.allAction')"
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
        {{ i18n.t("spaces.aiOperations.noDeliverables") }}
      </div>

      <div
        v-for="item in deliverables"
        :key="item.fileName"
        class="rounded-lg px-1 py-1"
      >
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="hover:bg-accent min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs"
            @click="onPreview(item)"
          >
            {{ item.fileName }}
          </button>
          <UiActionButton
            :tooltip="i18n.t('button.copy')"
            @click="onCopy(item)"
          >
            <Copy class="h-3.5 w-3.5" />
          </UiActionButton>
          <UiActionButton
            :tooltip="i18n.t('spaces.aiOperations.export.action')"
            :disabled="isExporting"
            @click="onExport(item)"
          >
            <Upload class="h-3.5 w-3.5" />
          </UiActionButton>
        </div>

        <pre
          v-if="previewFileName === item.fileName && previewContent"
          class="bg-background scrollbar mt-1 max-h-48 overflow-auto rounded-md p-2 text-[11px] leading-relaxed whitespace-pre-wrap"
        >{{ previewContent }}</pre>
      </div>
    </div>
  </div>

  <AiOperationsExportDialog
    v-model:open="isExportDialogOpen"
    :title="
      exportAll ? i18n.t('spaces.aiOperations.export.allTitle') : undefined
    "
    :description="
      exportAll
        ? i18n.t('spaces.aiOperations.export.allDescription', {
          count: deliverables.length,
        })
        : undefined
    "
    @confirm="onExportConfirm"
  />
</template>
