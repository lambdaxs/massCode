<script setup lang="ts">
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import {
  useActivityTracker,
  useApp,
  useCopyTracker,
  useDonationTriggers,
  useSonner,
  useTheme,
  useVaultDoctor,
  VAULT_DOCTOR_NOTICE_ID,
} from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { router, RouterName } from '@/router'
import { getSpaceDefinitions, isSpaceRouteName } from '@/spaceDefinitions'
import { isMac } from '@/utils'
import { LoaderCircle } from 'lucide-vue-next'
import { loadWASM } from 'onigasm'
import onigasmFile from 'onigasm/lib/onigasm.wasm?url'
import { useRoute } from 'vue-router'
import { Toaster } from 'vue-sonner'
import { repository, version } from '../../package.json'
import { loadGrammars } from './components/editor/grammars'
import { registerIPCListeners } from './ipc'

const { isAppLoading, isSponsored } = useApp()
const route = useRoute()

const isTaskTimerFloat = computed(
  () => route.name === RouterName.taskTimerFloat,
)
const showLoader = ref(false)

const isMainRoute = computed(() => route.name === RouterName.main)
const isLoaderVisible = computed(
  () => !isTaskTimerFloat.value && isMainRoute.value && isAppLoading.value,
)

watch(
  isLoaderVisible,
  (value) => {
    if (!value) {
      showLoader.value = false
      return
    }

    const timer = setTimeout(() => {
      showLoader.value = true
    }, 300)

    onWatcherCleanup(() => clearTimeout(timer))
  },
  { immediate: true },
)

watch(
  isMainRoute,
  (value) => {
    if (!value) {
      isAppLoading.value = false
    }
  },
  { immediate: true },
)

watch(
  () => route.name,
  (routeName) => {
    if (
      routeName === RouterName.notesSpace
      || routeName === RouterName.notesDashboard
      || routeName === RouterName.notesGraph
    ) {
      store.app.set('notes.route', routeName)
    }
  },
  { immediate: true },
)

useTheme()

// 应用版本变更后的一次性 toast；内容来自 release notes。
function showWhatsNewOnce() {
  if (store.app.get('notifications.lastWhatsNewVersion') === version) {
    return
  }

  store.app.set('notifications.lastWhatsNewVersion', version)

  const { sonner } = useSonner()

  sonner({
    message: i18n.t('messages:update.whatsNewToast', { version }),
    type: 'success',
    closeButton: true,
    action: {
      label: i18n.t('messages:update.releaseNotes'),
      onClick: () => {
        ipc.invoke(
          'system:open-external',
          `${repository}/releases/tag/v${version}`,
        )
      },
    },
  })
}

// 应用加载后对 vault 的非阻塞检查。Doctor 在 Storage 设置中，用户很少进入，
// 因此对同步冲突（重复 id、merge 标记、损坏 frontmatter）主动提示。
// Safe fixes 不在此处理——由 watcher 静默应用。
function checkVaultHealth() {
  const { sonner } = useSonner()
  const { scan } = useVaultDoctor()

  const run = async () => {
    try {
      const data = await scan()
      if (!data || data.summary.conflicts === 0) {
        return
      }

      sonner({
        id: VAULT_DOCTOR_NOTICE_ID,
        message: i18n.t('messages:warning.vaultDoctorConflicts', {
          count: data.summary.conflicts,
        }),
        type: 'warning',
        closeButton: true,
        action: {
          label: i18n.t('messages:warning.vaultDoctorReview'),
          onClick: () => {
            router.push({
              name: RouterName.preferencesStorage,
              query: { doctor: 'scan' },
            })
          },
        },
      })
    }
    catch {
      // Health check 非关键：出错时静默跳过。
    }
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => run(), { timeout: 5000 })
  }
  else {
    setTimeout(run, 2000)
  }
}

function restoreSavedSpace() {
  const savedSpaceId = store.app.get<string>('activeSpaceId')
  if (savedSpaceId && savedSpaceId !== 'code') {
    const space = getSpaceDefinitions().find(s => s.id === savedSpaceId)
    if (space) {
      router.replace(space.to)
    }
  }
}

async function init() {
  if (isTaskTimerFloat.value) {
    return
  }

  registerIPCListeners()
  ipc.send('system:renderer-ready', null, () => {})
  restoreSavedSpace()
  loadWASM(onigasmFile)
  await loadGrammars()
  useActivityTracker()
  useCopyTracker()
  if (!isSponsored.value) {
    useDonationTriggers()
  }
  showWhatsNewOnce()
  checkVaultHealth()
}

init()
</script>

<template>
  <Tooltip.TooltipProvider v-if="!isTaskTimerFloat">
    <div
      v-if="isMac"
      data-title-bar
      class="absolute top-0 z-50 h-3 w-full select-none"
    />
    <RouterView v-slot="{ Component, route: currentRoute }">
      <AppSpaceShell
        v-if="isSpaceRouteName(currentRoute.name)"
        :show-rail="currentRoute.name !== RouterName.notesPresentation"
      >
        <component :is="Component" />
      </AppSpaceShell>
      <component
        :is="Component"
        v-else
      />
    </RouterView>
    <ImportsImportDialog />
    <CommandPalette />
    <div
      v-if="isLoaderVisible"
      class="bg-background absolute inset-0 z-50 flex flex-col items-center justify-center"
    >
      <template v-if="showLoader">
        {{ i18n.t("loading") }}
        <LoaderCircle class="text-muted-foreground mt-4 h-5 w-5 animate-spin" />
      </template>
    </div>
    <Toaster style="--width: 356px; --offset: 12px" />
  </Tooltip.TooltipProvider>
  <div
    v-else
    class="h-full w-full overflow-hidden"
  >
    <RouterView />
  </div>
</template>

<style>
[data-title-bar] {
  -webkit-app-region: drag;
}
</style>
