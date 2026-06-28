<script setup lang="ts">
import { useApp } from '@/composables'
import { useAiOperations } from '@/composables/spaces/aiOperations/useAiOperations'
import { i18n } from '@/electron'

const { isAppLoading } = useApp()
const { init, activeSession, createSession } = useAiOperations()

onMounted(async () => {
  await init()
  if (!activeSession.value) {
    await createSession()
  }
  isAppLoading.value = false
})
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('spaces.aiOperations.title')"
    :show-back="false"
  >
    <template #leftHeader>
      <div class="px-1 pt-[var(--content-top-offset)]" />
    </template>
    <template #left>
      <AiOperationsSessionList />
    </template>
    <template #right>
      <AiOperationsChat v-if="activeSession" />
      <div
        v-else
        class="text-muted-foreground flex h-full items-center justify-center text-sm"
      >
        {{ i18n.t("spaces.aiOperations.noSession") }}
      </div>
    </template>
  </LayoutTwoColumn>
</template>
