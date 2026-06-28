<script setup lang="ts">
import type { AiPrototypeSessionSummary } from '~/shared/aiPrototype'
import { useAiPrototype } from '@/composables/spaces/aiPrototype/useAiPrototype'
import { i18n } from '@/electron'
import { Plus, Trash2 } from 'lucide-vue-next'

const {
  sessions,
  totals,
  skills,
  activeSessionId,
  credits,
  isCreditsLoading,
  createSession,
  deleteSession,
  selectSession,
} = useAiPrototype()

const showCreate = ref(false)
const title = ref('')
const skillId = ref('')

const formattedCredits = computed(() => {
  if (credits.value === null) {
    return null
  }

  return credits.value.toLocaleString()
})

async function onCreateSession() {
  await createSession({
    title: title.value.trim() || undefined,
    skillId: skillId.value || undefined,
  })
  showCreate.value = false
  title.value = ''
  skillId.value = ''
}

async function onSelectSession(session: AiPrototypeSessionSummary) {
  await selectSession(session.id)
}

async function onDeleteSession(sessionId: string) {
  await deleteSession(sessionId)
}
</script>

<template>
  <div class="flex h-full flex-col px-1">
    <SidebarHeader
      :title="i18n.t('spaces.aiPrototype.title')"
      :section-title="i18n.t('spaces.aiPrototype.sessionList')"
    >
      <template #action>
        <UiActionButton
          :tooltip="i18n.t('spaces.aiPrototype.newSession')"
          @click="showCreate = !showCreate"
        >
          <Plus class="h-4 w-4" />
        </UiActionButton>
      </template>
    </SidebarHeader>

    <div class="text-muted-foreground px-1 py-2 text-[11px] leading-none">
      {{
        i18n.t("spaces.aiPrototype.statsSummary", {
          messages: totals.messages,
          succeeded: totals.succeeded,
          failed: totals.failed,
        })
      }}
    </div>

    <div
      class="text-muted-foreground border-border border-b px-1 pb-2 text-[11px] leading-none"
    >
      <span v-if="isCreditsLoading">
        {{ i18n.t("spaces.aiPrototype.credits.loading") }}
      </span>
      <span v-else-if="formattedCredits !== null">
        {{
          i18n.t("spaces.aiPrototype.credits.balance", {
            balance: formattedCredits,
          })
        }}
      </span>
      <span v-else>
        {{ i18n.t("spaces.aiPrototype.credits.unavailable") }}
      </span>
    </div>

    <div
      v-if="showCreate"
      class="border-border space-y-2 border-b px-1 py-2"
    >
      <UiInput
        v-model="title"
        variant="default"
        class="text-xs"
        :placeholder="i18n.t('spaces.aiPrototype.sessionTitlePlaceholder')"
      />
      <select
        v-model="skillId"
        class="border-input bg-background h-8 w-full rounded-md border px-2 text-xs"
      >
        <option value="">
          {{ i18n.t("spaces.aiPrototype.noSkill") }}
        </option>
        <option
          v-for="skill in skills"
          :key="skill.id"
          :value="skill.id"
        >
          {{ skill.name }}
        </option>
      </select>
      <button
        type="button"
        class="bg-primary text-primary-foreground w-full rounded-md px-2 py-1.5 text-xs"
        @click="onCreateSession"
      >
        {{ i18n.t("spaces.aiPrototype.createSession") }}
      </button>
    </div>

    <div class="scrollbar min-h-0 flex-1 overflow-y-auto">
      <button
        v-for="session in sessions"
        :key="session.id"
        type="button"
        class="hover:bg-accent mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
        :class="
          activeSessionId === session.id
            ? 'bg-accent text-accent-foreground'
            : ''
        "
        @click="onSelectSession(session)"
      >
        <div class="min-w-0 flex-1">
          <div class="truncate text-xs font-medium">
            {{ session.title }}
          </div>
          <div class="text-muted-foreground text-[10px]">
            {{
              i18n.t("spaces.aiPrototype.sessionMeta", {
                messages: session.messageCount,
                succeeded: session.successCount,
                deliverables: session.deliverableCount ?? 0,
              })
            }}
          </div>
        </div>
        <UiActionButton
          :tooltip="i18n.t('button.delete')"
          @click.stop="onDeleteSession(session.id)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </UiActionButton>
      </button>
    </div>

    <AiPrototypeSkillsPanel />
  </div>
</template>
