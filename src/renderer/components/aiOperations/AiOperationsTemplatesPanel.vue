<script setup lang="ts">
import type { AiOperationsTemplate } from '~/shared/aiOperations'
import { useDialog, useSonner } from '@/composables'
import { useAiOperations } from '@/composables/spaces/aiOperations/useAiOperations'
import { i18n } from '@/electron'
import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-vue-next'

const { templates, deleteTemplate } = useAiOperations()
const { sonner } = useSonner()
const { confirm } = useDialog()

const expanded = ref(true)
const isDialogOpen = ref(false)
const editingTemplate = ref<AiOperationsTemplate | null>(null)
const sourceTemplate = ref<AiOperationsTemplate | null>(null)
const isReadonly = ref(false)

function resetDialogState() {
  editingTemplate.value = null
  sourceTemplate.value = null
  isReadonly.value = false
}

function onCreate() {
  resetDialogState()
  isDialogOpen.value = true
}

function onView(template: AiOperationsTemplate) {
  if (!template.builtin) {
    onEdit(template)
    return
  }

  resetDialogState()
  editingTemplate.value = template
  isReadonly.value = true
  isDialogOpen.value = true
}

function onEdit(template: AiOperationsTemplate) {
  if (template.builtin) {
    onView(template)
    return
  }

  resetDialogState()
  editingTemplate.value = template
  isDialogOpen.value = true
}

function onDuplicate(template: AiOperationsTemplate) {
  resetDialogState()
  sourceTemplate.value = template
  isDialogOpen.value = true
}

function onDialogDuplicate(template: AiOperationsTemplate) {
  isDialogOpen.value = false
  nextTick(() => {
    onDuplicate(template)
  })
}

async function onDelete(template: AiOperationsTemplate) {
  if (template.builtin) {
    return
  }

  const accepted = await confirm({
    title: i18n.t('spaces.aiOperations.templates.deleteConfirmTitle'),
    description: i18n.t('spaces.aiOperations.templates.deleteConfirmMessage', {
      name: template.name,
    }),
  })

  if (!accepted) {
    return
  }

  try {
    await deleteTemplate(template.id)
    sonner({
      message: i18n.t('spaces.aiOperations.templates.deleteSuccess'),
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

function platformLabel(template: AiOperationsTemplate): string | null {
  if (template.platform === 'xiaohongshu') {
    return i18n.t('spaces.aiOperations.templates.platformXiaohongshu')
  }

  if (template.platform === 'wechat') {
    return i18n.t('spaces.aiOperations.templates.platformWechat')
  }

  if (template.platform === 'generic') {
    return i18n.t('spaces.aiOperations.templates.platformUnspecified')
  }

  return null
}
</script>

<template>
  <div class="border-border mt-2 border-t pt-2">
    <div class="mb-1 flex items-center justify-between px-1">
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground text-[11px] font-medium"
        @click="expanded = !expanded"
      >
        {{ i18n.t("spaces.aiOperations.templates.title") }}
        <span>({{ templates.length }})</span>
      </button>
      <UiActionButton
        :tooltip="i18n.t('spaces.aiOperations.templates.createTitle')"
        @click="onCreate"
      >
        <Plus class="h-3.5 w-3.5" />
      </UiActionButton>
    </div>

    <div
      v-if="expanded"
      class="scrollbar max-h-48 space-y-0.5 overflow-y-auto px-1"
    >
      <div
        v-for="template in templates"
        :key="template.id"
        class="hover:bg-accent group flex items-center gap-1 rounded-md px-1.5 py-1.5"
      >
        <button
          type="button"
          class="min-w-0 flex-1 text-left"
          @click="onView(template)"
        >
          <div class="flex items-center gap-1.5">
            <span class="truncate text-[11px] font-medium">
              {{ template.name }}
            </span>
            <span
              class="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium"
              :class="
                template.builtin
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              "
            >
              {{
                template.builtin
                  ? i18n.t("spaces.aiOperations.templates.builtin")
                  : i18n.t("spaces.aiOperations.templates.custom")
              }}
            </span>
          </div>
          <div
            v-if="platformLabel(template)"
            class="text-muted-foreground mt-0.5 truncate text-[10px]"
          >
            {{ platformLabel(template) }}
          </div>
        </button>

        <UiActionButton
          v-if="template.builtin"
          :tooltip="i18n.t('spaces.aiOperations.templates.duplicateAction')"
          @click="onDuplicate(template)"
        >
          <Copy class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          v-if="template.builtin"
          :tooltip="i18n.t('spaces.aiOperations.templates.viewTitle')"
          @click="onView(template)"
        >
          <Eye class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          v-if="!template.builtin"
          :tooltip="i18n.t('spaces.aiOperations.templates.editTitle')"
          @click="onEdit(template)"
        >
          <Pencil class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          v-if="!template.builtin"
          :tooltip="i18n.t('button.delete')"
          @click="onDelete(template)"
        >
          <Trash2 class="h-3 w-3" />
        </UiActionButton>
      </div>
    </div>

    <AiOperationsTemplateDialog
      v-model:open="isDialogOpen"
      :template="editingTemplate"
      :source-template="sourceTemplate"
      :readonly="isReadonly"
      @duplicate="onDialogDuplicate"
    />
  </div>
</template>
