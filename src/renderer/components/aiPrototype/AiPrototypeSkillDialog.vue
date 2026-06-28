<script setup lang="ts">
import type { AiPrototypeSkill } from '~/shared/aiPrototype'
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useSonner } from '@/composables'
import { useAiPrototype } from '@/composables/spaces/aiPrototype/useAiPrototype'
import { i18n } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'

const props = defineProps<{
  skill?: AiPrototypeSkill | null
  sourceSkill?: AiPrototypeSkill | null
  initialSystemPrompt?: string
  draftSessionId?: string | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  saved: [skill: AiPrototypeSkill]
  duplicate: [skill: AiPrototypeSkill]
}>()

const open = defineModel<boolean>('open', { required: true })

const { createSkill, updateSkill, draftSkillFromSession } = useAiPrototype()
const { sonner } = useSonner()

const name = ref('')
const tagsInput = ref('')
const systemPrompt = ref('')
const aspectRatio = ref('')
const deliverableHintsInput = ref('')
const isSaving = ref(false)
const isDrafting = ref(false)
const showValidation = ref(false)
const nameInputFocus = ref(false)

const isReadonly = computed(() => props.readonly === true)
const isEditMode = computed(() =>
  Boolean(props.skill && !props.skill.builtin && !isReadonly.value),
)
const isDuplicateMode = computed(() =>
  Boolean(props.sourceSkill && !props.skill && !isReadonly.value),
)

const dialogTitle = computed(() => {
  if (isReadonly.value) {
    return i18n.t('spaces.aiPrototype.skills.viewTitle')
  }
  if (isEditMode.value) {
    return i18n.t('spaces.aiPrototype.skills.editTitle')
  }
  if (isDuplicateMode.value) {
    return i18n.t('spaces.aiPrototype.skills.duplicateTitle')
  }
  return i18n.t('spaces.aiPrototype.skills.createTitle')
})

const nameError = computed(() => {
  if (!showValidation.value || name.value.trim()) {
    return ''
  }
  return i18n.t('spaces.aiPrototype.errors.SKILL_NAME_MISSING')
})

const systemPromptError = computed(() => {
  if (!showValidation.value || systemPrompt.value.trim()) {
    return ''
  }
  return i18n.t('spaces.aiPrototype.errors.SKILL_PROMPT_MISSING')
})

function fillFromSkill(skill: AiPrototypeSkill) {
  name.value = skill.name
  tagsInput.value = skill.tags?.join(', ') ?? ''
  systemPrompt.value = skill.systemPrompt
  aspectRatio.value = skill.defaults?.aspectRatio ?? ''
  deliverableHintsInput.value = skill.deliverableHints?.join('\n') ?? ''
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

    if (props.skill) {
      fillFromSkill(props.skill)
      nameInputFocus.value = !isReadonly.value && !props.skill.builtin
      return
    }

    if (props.sourceSkill) {
      fillFromSkill(props.sourceSkill)
      name.value = i18n.t('spaces.aiPrototype.skills.duplicateName', {
        name: props.sourceSkill.name,
      })
      nameInputFocus.value = true
      return
    }

    name.value = ''
    tagsInput.value = ''
    systemPrompt.value = props.initialSystemPrompt?.trim() ?? ''
    aspectRatio.value = ''
    deliverableHintsInput.value = ''
    nameInputFocus.value = true
  },
  { immediate: true },
)

function showError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const knownKey = `spaces.aiPrototype.errors.${message}`
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
    const result = await draftSkillFromSession(props.draftSessionId)
    systemPrompt.value = result.systemPrompt
    sonner({
      message: i18n.t('spaces.aiPrototype.skills.draftSuccess'),
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

function parseTags(): string[] | undefined {
  const tags = tagsInput.value
    .split(/[,，]/)
    .map(tag => tag.trim())
    .filter(Boolean)
  return tags.length ? tags : undefined
}

function parseDeliverableHints(): string[] | undefined {
  const hints = deliverableHintsInput.value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  return hints.length ? hints : undefined
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
      tags: parseTags(),
      systemPrompt: systemPrompt.value.trim(),
      defaults: aspectRatio.value.trim()
        ? { aspectRatio: aspectRatio.value.trim() }
        : undefined,
      deliverableHints: parseDeliverableHints(),
    }

    const saved
      = isEditMode.value && props.skill
        ? await updateSkill(props.skill.id, payload)
        : await createSkill(payload)

    emit('saved', saved)
    open.value = false
    sonner({
      message: i18n.t('spaces.aiPrototype.skills.saveSuccess'),
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
  const source = props.skill ?? props.sourceSkill
  if (source) {
    emit('duplicate', source)
  }
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
              ? i18n.t("spaces.aiPrototype.skills.builtinReadonlyHint")
              : i18n.t("spaces.aiPrototype.skills.formHint")
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
            {{ i18n.t("spaces.aiPrototype.skills.name") }}
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
            :placeholder="i18n.t('spaces.aiPrototype.skills.namePlaceholder')"
            :error="nameError"
          />
        </div>

        <div class="space-y-1.5">
          <UiText
            as="label"
            variant="sm"
            weight="medium"
          >
            {{ i18n.t("spaces.aiPrototype.skills.tags") }}
          </UiText>
          <UiInput
            v-model="tagsInput"
            variant="default"
            :readonly="isReadonly"
            :placeholder="i18n.t('spaces.aiPrototype.skills.tagsPlaceholder')"
          />
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <UiText
              as="label"
              variant="sm"
              weight="medium"
            >
              {{ i18n.t("spaces.aiPrototype.skills.systemPrompt") }}
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
              {{ i18n.t("spaces.aiPrototype.skills.draftFromSession") }}
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
              i18n.t('spaces.aiPrototype.skills.systemPromptPlaceholder')
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
            {{ i18n.t("spaces.aiPrototype.skills.deliverableHints") }}
          </UiText>
          <UiInput
            v-model="deliverableHintsInput"
            type="textarea"
            variant="default"
            :readonly="isReadonly"
            :rows="3"
            :placeholder="
              i18n.t('spaces.aiPrototype.skills.deliverableHintsPlaceholder')
            "
          />
        </div>

        <div class="space-y-1.5">
          <UiText
            as="label"
            variant="sm"
            weight="medium"
          >
            {{ i18n.t("spaces.aiPrototype.skills.aspectRatio") }}
          </UiText>
          <UiInput
            v-model="aspectRatio"
            variant="default"
            :readonly="isReadonly"
            placeholder="1024x1024"
            :description="i18n.t('spaces.aiPrototype.skills.aspectRatioHint')"
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
          v-if="isReadonly && (skill?.builtin || sourceSkill?.builtin)"
          @click="onDuplicateBuiltin"
        >
          {{ i18n.t("spaces.aiPrototype.skills.duplicateAction") }}
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
