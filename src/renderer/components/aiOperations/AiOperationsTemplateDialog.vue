<script setup lang="ts">
import type { AiOperationsTemplate } from '~/shared/aiOperations'
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import * as Select from '@/components/ui/shadcn/select'
import { useSonner } from '@/composables'
import { useAiOperations } from '@/composables/spaces/aiOperations/useAiOperations'
import { i18n } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'

const props = defineProps<{
  template?: AiOperationsTemplate | null
  sourceTemplate?: AiOperationsTemplate | null
  initialSystemPrompt?: string
  draftSessionId?: string | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  saved: [template: AiOperationsTemplate]
  duplicate: [template: AiOperationsTemplate]
}>()

const open = defineModel<boolean>('open', { required: true })

const { createTemplate, updateTemplate, draftTemplateFromSession }
  = useAiOperations()
const { sonner } = useSonner()

const name = ref('')
const platform = ref<string>('none')
const tagsInput = ref('')
const systemPrompt = ref('')
const aspectRatio = ref('')
const isSaving = ref(false)
const isDrafting = ref(false)
const showValidation = ref(false)
const nameInputFocus = ref(false)

const isReadonly = computed(() => props.readonly === true)
const isEditMode = computed(() =>
  Boolean(props.template && !props.template.builtin && !isReadonly.value),
)
const isDuplicateMode = computed(() =>
  Boolean(props.sourceTemplate && !props.template && !isReadonly.value),
)

const dialogTitle = computed(() => {
  if (isReadonly.value) {
    return i18n.t('spaces.aiOperations.templates.viewTitle')
  }

  if (isEditMode.value) {
    return i18n.t('spaces.aiOperations.templates.editTitle')
  }

  if (isDuplicateMode.value) {
    return i18n.t('spaces.aiOperations.templates.duplicateTitle')
  }

  return i18n.t('spaces.aiOperations.templates.createTitle')
})

const nameError = computed(() => {
  if (!showValidation.value || name.value.trim()) {
    return ''
  }

  return i18n.t('spaces.aiOperations.errors.TEMPLATE_NAME_MISSING')
})

const systemPromptError = computed(() => {
  if (!showValidation.value || systemPrompt.value.trim()) {
    return ''
  }

  return i18n.t('spaces.aiOperations.errors.TEMPLATE_PROMPT_MISSING')
})

function fillFromTemplate(template: AiOperationsTemplate) {
  name.value = template.name
  platform.value = template.platform ?? 'none'
  tagsInput.value = template.tags?.join(', ') ?? ''
  systemPrompt.value = template.systemPrompt
  aspectRatio.value = template.defaults?.aspectRatio ?? ''
}

function resetFormFields() {
  name.value = ''
  platform.value = 'none'
  tagsInput.value = ''
  systemPrompt.value = props.initialSystemPrompt?.trim() ?? ''
  aspectRatio.value = ''
}

watch(
  open,
  (value) => {
    if (!value) {
      showValidation.value = false
      nameInputFocus.value = false
      return
    }

    showValidation.value = false

    if (props.template) {
      fillFromTemplate(props.template)
      nameInputFocus.value = !isReadonly.value && !props.template.builtin
      return
    }

    if (props.sourceTemplate) {
      fillFromTemplate(props.sourceTemplate)
      name.value = i18n.t('spaces.aiOperations.templates.duplicateName', {
        name: props.sourceTemplate.name,
      })
      nameInputFocus.value = true
      return
    }

    resetFormFields()
    nameInputFocus.value = true
  },
  { immediate: true },
)

function parseTags(): string[] | undefined {
  const tags = tagsInput.value
    .split(/[,，]/)
    .map(tag => tag.trim())
    .filter(Boolean)

  return tags.length ? tags : undefined
}

function resolvePlatform(): AiOperationsTemplate['platform'] | undefined {
  if (platform.value === 'none' || platform.value === 'generic') {
    return platform.value === 'generic' ? 'generic' : undefined
  }

  return platform.value as AiOperationsTemplate['platform']
}

function showError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const knownKey = `spaces.aiOperations.errors.${message}`
  sonner({
    message: i18n.t(knownKey) !== knownKey ? i18n.t(knownKey) : message,
    type: 'error',
  })
}

async function onDraftFromSession() {
  if (!props.draftSessionId) {
    return
  }

  isDrafting.value = true

  try {
    const result = await draftTemplateFromSession(props.draftSessionId)
    systemPrompt.value = result.systemPrompt
    sonner({
      message: i18n.t('spaces.aiOperations.templates.draftSuccess'),
      type: 'success',
    })
  }
  catch (error) {
    showError(error)
  }
  finally {
    isDrafting.value = false
  }
}

async function onSave() {
  if (isReadonly.value) {
    return
  }

  showValidation.value = true

  if (!name.value.trim() || !systemPrompt.value.trim()) {
    return
  }

  isSaving.value = true

  try {
    const payload = {
      name: name.value.trim(),
      platform: resolvePlatform(),
      tags: parseTags(),
      systemPrompt: systemPrompt.value.trim(),
      defaults: aspectRatio.value.trim()
        ? { aspectRatio: aspectRatio.value.trim() }
        : undefined,
    }

    const saved
      = isEditMode.value && props.template
        ? await updateTemplate(props.template.id, payload)
        : await createTemplate(payload)

    emit('saved', saved)
    open.value = false
    sonner({
      message: i18n.t('spaces.aiOperations.templates.saveSuccess'),
      type: 'success',
    })
  }
  catch (error) {
    showError(error)
  }
  finally {
    isSaving.value = false
  }
}

function onDuplicateBuiltin() {
  const source = props.template ?? props.sourceTemplate
  if (!source) {
    return
  }

  emit('duplicate', source)
}
</script>

<template>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      class="grid max-h-[calc(100dvh-4rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-xl"
      @open-auto-focus="(event) => event.preventDefault()"
    >
      <Dialog.DialogHeader
        class="border-border space-y-1.5 border-b px-6 py-4 pr-12"
      >
        <Dialog.DialogTitle class="text-base leading-6">
          {{ dialogTitle }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription class="text-xs leading-5">
          {{
            isReadonly
              ? i18n.t("spaces.aiOperations.templates.builtinReadonlyHint")
              : i18n.t("spaces.aiOperations.templates.formHint")
          }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>

      <div class="scrollbar min-h-0 space-y-4 overflow-y-auto px-6 py-4">
        <div class="space-y-1.5">
          <UiText
            as="label"
            variant="sm"
            weight="medium"
          >
            {{ i18n.t("spaces.aiOperations.templates.name") }}
            <span
              v-if="!isReadonly"
              class="text-destructive"
            >*</span>
          </UiText>
          <UiInput
            v-model="name"
            variant="default"
            :readonly="isReadonly"
            :focus="nameInputFocus"
            :placeholder="
              i18n.t('spaces.aiOperations.templates.namePlaceholder')
            "
            :error="nameError"
          />
        </div>

        <div class="space-y-1.5">
          <UiText
            as="label"
            variant="sm"
            weight="medium"
          >
            {{ i18n.t("spaces.aiOperations.templates.platform") }}
          </UiText>
          <Select.Select
            v-if="!isReadonly"
            v-model="platform"
          >
            <Select.SelectTrigger
              class="border-border bg-background h-9 w-full"
            >
              <Select.SelectValue />
            </Select.SelectTrigger>
            <Select.SelectContent>
              <Select.SelectItem value="none">
                {{ i18n.t("spaces.aiOperations.templates.platformGeneric") }}
              </Select.SelectItem>
              <Select.SelectItem value="xiaohongshu">
                {{
                  i18n.t("spaces.aiOperations.templates.platformXiaohongshu")
                }}
              </Select.SelectItem>
              <Select.SelectItem value="wechat">
                {{ i18n.t("spaces.aiOperations.templates.platformWechat") }}
              </Select.SelectItem>
              <Select.SelectItem value="generic">
                {{
                  i18n.t("spaces.aiOperations.templates.platformUnspecified")
                }}
              </Select.SelectItem>
            </Select.SelectContent>
          </Select.Select>
          <UiInput
            v-else
            variant="default"
            readonly
            :model-value="
              platform === 'xiaohongshu'
                ? i18n.t('spaces.aiOperations.templates.platformXiaohongshu')
                : platform === 'wechat'
                  ? i18n.t('spaces.aiOperations.templates.platformWechat')
                  : platform === 'generic'
                    ? i18n.t(
                      'spaces.aiOperations.templates.platformUnspecified',
                    )
                    : i18n.t('spaces.aiOperations.templates.platformGeneric')
            "
          />
        </div>

        <div class="space-y-1.5">
          <UiText
            as="label"
            variant="sm"
            weight="medium"
          >
            {{ i18n.t("spaces.aiOperations.templates.tags") }}
          </UiText>
          <UiInput
            v-model="tagsInput"
            variant="default"
            :readonly="isReadonly"
            :placeholder="
              i18n.t('spaces.aiOperations.templates.tagsPlaceholder')
            "
          />
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <UiText
              as="label"
              size="sm"
              weight="medium"
            >
              {{ i18n.t("spaces.aiOperations.templates.systemPrompt") }}
              <span
                v-if="!isReadonly"
                class="text-destructive"
              >*</span>
            </UiText>
            <Button
              v-if="draftSessionId && !isReadonly"
              variant="outline"
              size="sm"
              class="h-7 shrink-0 text-xs"
              :disabled="isDrafting"
              @click="onDraftFromSession"
            >
              <LoaderCircle
                v-if="isDrafting"
                class="mr-1 h-3 w-3 animate-spin"
              />
              {{ i18n.t("spaces.aiOperations.templates.draftFromSession") }}
            </Button>
          </div>
          <UiInput
            v-model="systemPrompt"
            type="textarea"
            variant="default"
            :readonly="isReadonly"
            :rows="10"
            class="min-h-44 font-mono text-[13px] leading-relaxed"
            :placeholder="
              i18n.t('spaces.aiOperations.templates.systemPromptPlaceholder')
            "
            :error="systemPromptError"
          />
        </div>

        <div class="space-y-1.5">
          <UiText
            as="label"
            variant="sm"
            weight="medium"
          >
            {{ i18n.t("spaces.aiOperations.templates.aspectRatio") }}
          </UiText>
          <UiInput
            v-model="aspectRatio"
            variant="default"
            :readonly="isReadonly"
            placeholder="768x1024"
            :description="
              i18n.t('spaces.aiOperations.templates.aspectRatioHint')
            "
          />
        </div>
      </div>

      <Dialog.DialogFooter class="border-border gap-2 border-t px-6 py-4">
        <Button
          variant="outline"
          @click="open = false"
        >
          {{ i18n.t(isReadonly ? "action.close" : "button.cancel") }}
        </Button>
        <Button
          v-if="isReadonly && (template?.builtin || sourceTemplate?.builtin)"
          @click="onDuplicateBuiltin"
        >
          {{ i18n.t("spaces.aiOperations.templates.duplicateAction") }}
        </Button>
        <Button
          v-if="!isReadonly"
          :disabled="isSaving"
          @click="onSave"
        >
          <LoaderCircle
            v-if="isSaving"
            class="mr-1.5 h-3.5 w-3.5 animate-spin"
          />
          {{ i18n.t("button.confirm") }}
        </Button>
      </Dialog.DialogFooter>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
