<script setup lang="ts">
import type { AiPrototypeSessionSummary } from '~/shared/aiPrototype'
import { useAiPrototype } from '@/composables/spaces/aiPrototype/useAiPrototype'
import { i18n } from '@/electron'
import { Plus, Trash2 } from 'lucide-vue-next'

const {
  sessions,
  totals,
  activeSessionId,
  createSession,
  deleteSession,
  selectSession,
} = useAiPrototype()

async function onCreateSession() {
  await createSession()
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
          @click="onCreateSession"
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
  </div>
</template>
