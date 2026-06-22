<script setup lang="ts">
import { useApp } from '@/composables'
import { useAiPrototype } from '@/composables/spaces/aiPrototype/useAiPrototype'
import { i18n } from '@/electron'

const { isAppLoading } = useApp()
const { init, activeSession, createSession } = useAiPrototype()

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
    :title="i18n.t('spaces.aiPrototype.title')"
    :show-back="false"
  >
    <template #leftHeader>
      <div class="px-1 pt-[var(--content-top-offset)]" />
    </template>
    <template #left>
      <AiPrototypeSessionList />
    </template>
    <template #right>
      <AiPrototypeChat v-if="activeSession" />
      <div
        v-else
        class="text-muted-foreground flex h-full items-center justify-center text-sm"
      >
        {{ i18n.t("spaces.aiPrototype.noSession") }}
      </div>
    </template>
  </LayoutTwoColumn>
</template>
