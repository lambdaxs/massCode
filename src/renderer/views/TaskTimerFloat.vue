<script setup lang="ts">
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { useTaskTimer } from '@/composables/useTaskTimer'
import { useTheme } from '@/composables/useTheme'
import { i18n, ipc } from '@/electron'
import { Maximize2, Pause, Play, X } from 'lucide-vue-next'
import { formatTaskTimerElapsed } from '~/shared/taskTimer'

const { isDark } = useTheme()

watch(
  isDark,
  (dark) => {
    void ipc.invoke('system:task-timer-set-background', { isDark: dark })
  },
  { immediate: true },
)

const { state, pause, resume, stop, openMain } = useTaskTimer()
const isHovered = ref(false)

const isRunning = computed(() => state.status === 'running')

async function onPauseOrResumeClick() {
  if (isRunning.value) {
    await pause()
    return
  }

  await resume()
}

async function onStopClick() {
  await stop()
}

async function onExpandClick() {
  await openMain()
}
</script>

<template>
  <Tooltip.TooltipProvider>
    <div
      class="bg-background border-border relative box-border h-full w-full overflow-hidden rounded-lg border shadow-sm select-none"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <div
        class="text-muted-foreground flex h-full w-full items-center px-2.5 text-[10px] leading-none transition-opacity"
        :class="isHovered ? 'pointer-events-none opacity-0' : 'opacity-100'"
        style="-webkit-app-region: drag"
      >
        <span class="min-w-0 flex-1 truncate">{{ state.title.trim() }}</span>
        <span class="text-foreground ml-1.5 shrink-0 tabular-nums">
          {{ formatTaskTimerElapsed(state.elapsedMs) }}
        </span>
      </div>
      <div
        class="bg-background absolute inset-0 flex items-center rounded-lg transition-opacity"
        :class="isHovered ? 'opacity-100' : 'pointer-events-none opacity-0'"
      >
        <div
          class="h-full min-w-0 flex-1"
          style="-webkit-app-region: drag"
        />
        <div
          class="flex shrink-0 items-center gap-0.5"
          style="-webkit-app-region: no-drag"
        >
          <UiActionButton
            :tooltip="i18n.t('notes.tasks.timer.expand')"
            @click="onExpandClick"
          >
            <Maximize2 class="h-3 w-3" />
          </UiActionButton>
          <UiActionButton
            :tooltip="
              isRunning
                ? i18n.t('notes.tasks.timer.pause')
                : i18n.t('notes.tasks.timer.start')
            "
            :class="
              isRunning
                ? 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
                : undefined
            "
            @click="onPauseOrResumeClick"
          >
            <Pause
              v-if="isRunning"
              class="h-3 w-3"
            />
            <Play
              v-else
              class="h-3 w-3"
            />
          </UiActionButton>
          <UiActionButton
            :tooltip="i18n.t('notes.tasks.timer.stop')"
            @click="onStopClick"
          >
            <X class="h-3 w-3" />
          </UiActionButton>
        </div>
        <div
          class="h-full min-w-0 flex-1"
          style="-webkit-app-region: drag"
        />
      </div>
    </div>
  </Tooltip.TooltipProvider>
</template>
