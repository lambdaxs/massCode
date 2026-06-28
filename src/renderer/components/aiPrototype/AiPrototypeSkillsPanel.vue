<script setup lang="ts">
import type { AiPrototypeSkill } from '~/shared/aiPrototype'
import { useDialog, useSonner } from '@/composables'
import { useAiPrototype } from '@/composables/spaces/aiPrototype/useAiPrototype'
import { i18n } from '@/electron'
import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-vue-next'

const { skills, deleteSkill } = useAiPrototype()
const { sonner } = useSonner()
const { confirm } = useDialog()

const expanded = ref(true)
const isDialogOpen = ref(false)
const editingSkill = ref<AiPrototypeSkill | null>(null)
const sourceSkill = ref<AiPrototypeSkill | null>(null)
const isReadonly = ref(false)

function resetDialogState() {
  editingSkill.value = null
  sourceSkill.value = null
  isReadonly.value = false
}

function onCreate() {
  resetDialogState()
  isDialogOpen.value = true
}

function onView(skill: AiPrototypeSkill) {
  if (!skill.builtin) {
    onEdit(skill)
    return
  }

  resetDialogState()
  editingSkill.value = skill
  isReadonly.value = true
  isDialogOpen.value = true
}

function onEdit(skill: AiPrototypeSkill) {
  resetDialogState()
  editingSkill.value = skill
  isDialogOpen.value = true
}

function onDuplicate(skill: AiPrototypeSkill) {
  resetDialogState()
  sourceSkill.value = skill
  isDialogOpen.value = true
}

function onDialogDuplicate(skill: AiPrototypeSkill) {
  isDialogOpen.value = false
  nextTick(() => onDuplicate(skill))
}

async function onDelete(skill: AiPrototypeSkill) {
  if (skill.builtin) {
    return
  }

  const accepted = await confirm({
    title: i18n.t('spaces.aiPrototype.skills.deleteConfirmTitle'),
    description: i18n.t('spaces.aiPrototype.skills.deleteConfirmMessage', {
      name: skill.name,
    }),
  })

  if (!accepted) {
    return
  }

  try {
    await deleteSkill(skill.id)
    sonner({
      message: i18n.t('spaces.aiPrototype.skills.deleteSuccess'),
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
  <div class="border-border mt-2 border-t pt-2">
    <div class="mb-1 flex items-center justify-between px-1">
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground text-[11px] font-medium"
        @click="expanded = !expanded"
      >
        {{ i18n.t("spaces.aiPrototype.skills.title") }}
        <span>({{ skills.length }})</span>
      </button>
      <UiActionButton
        :tooltip="i18n.t('spaces.aiPrototype.skills.createTitle')"
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
        v-for="skill in skills"
        :key="skill.id"
        class="hover:bg-accent group flex items-center gap-1 rounded-md px-1.5 py-1.5"
      >
        <button
          type="button"
          class="min-w-0 flex-1 text-left"
          @click="onView(skill)"
        >
          <div class="flex items-center gap-1.5">
            <span class="truncate text-[11px] font-medium">{{
              skill.name
            }}</span>
            <span
              class="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium"
              :class="
                skill.builtin
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              "
            >
              {{
                skill.builtin
                  ? i18n.t("spaces.aiPrototype.skills.builtin")
                  : i18n.t("spaces.aiPrototype.skills.custom")
              }}
            </span>
          </div>
        </button>
        <UiActionButton
          v-if="skill.builtin"
          :tooltip="i18n.t('spaces.aiPrototype.skills.duplicateAction')"
          @click="onDuplicate(skill)"
        >
          <Copy class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          v-if="skill.builtin"
          :tooltip="i18n.t('spaces.aiPrototype.skills.viewTitle')"
          @click="onView(skill)"
        >
          <Eye class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          v-if="!skill.builtin"
          :tooltip="i18n.t('spaces.aiPrototype.skills.editTitle')"
          @click="onEdit(skill)"
        >
          <Pencil class="h-3 w-3" />
        </UiActionButton>
        <UiActionButton
          v-if="!skill.builtin"
          :tooltip="i18n.t('button.delete')"
          @click="onDelete(skill)"
        >
          <Trash2 class="h-3 w-3" />
        </UiActionButton>
      </div>
    </div>

    <AiPrototypeSkillDialog
      v-model:open="isDialogOpen"
      :skill="editingSkill"
      :source-skill="sourceSkill"
      :readonly="isReadonly"
      @duplicate="onDialogDuplicate"
    />
  </div>
</template>
