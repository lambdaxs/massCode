<script setup lang="ts">
import { i18n, ipc, store } from '@/electron'
import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, Check, Cloud, Loader2 } from 'lucide-vue-next'

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

interface SyncStatusEvent {
  status: SyncStatus
  message?: string
  lastSyncAt?: number
}

const syncConfig = store.preferences.get('sync')
const isConfigured = computed(
  () => !!syncConfig.serverUrl && !!syncConfig.token,
)
const autoSync = ref(syncConfig.autoSync)

const currentStatus = ref<SyncStatus>('idle')
const lastSyncAt = ref(syncConfig.lastSyncAt || 0)
const errorMessage = ref('')

const isVisible = computed(() => isConfigured.value && autoSync.value)

const formattedLastSync = computed(() => {
  if (!lastSyncAt.value)
    return ''
  return formatDistanceToNow(lastSyncAt.value, { addSuffix: true })
})

const statusIcon = computed(() => {
  switch (currentStatus.value) {
    case 'syncing':
      return Loader2
    case 'success':
      return Check
    case 'error':
      return AlertCircle
    default:
      return Cloud
  }
})

const statusColor = computed(() => {
  switch (currentStatus.value) {
    case 'syncing':
      return 'text-blue-500'
    case 'success':
      return 'text-green-500'
    case 'error':
      return 'text-red-500'
    default:
      return 'text-muted-foreground'
  }
})

const tooltipText = computed(() => {
  switch (currentStatus.value) {
    case 'syncing':
      return i18n.t('preferences:sync.syncing')
    case 'success':
      return `${i18n.t('preferences:sync.status.success')}${formattedLastSync.value ? ` · ${formattedLastSync.value}` : ''}`
    case 'error':
      return `${i18n.t('preferences:sync.status.failed')}: ${errorMessage.value}`
    default:
      return formattedLastSync.value
        ? `${i18n.t('preferences:sync.lastSyncAt')}: ${formattedLastSync.value}`
        : i18n.t('preferences:sync.never')
  }
})

// Listen for sync status changes from main process
ipc.on('sync:status-changed', (_, event: SyncStatusEvent) => {
  currentStatus.value = event.status

  if (event.lastSyncAt) {
    lastSyncAt.value = event.lastSyncAt
    store.preferences.set('sync.lastSyncAt', event.lastSyncAt)
  }

  if (event.message) {
    errorMessage.value = event.message
  }

  // Reset to idle after success
  if (event.status === 'success') {
    setTimeout(() => {
      currentStatus.value = 'idle'
    }, 3000)
  }
})

// Watch for settings changes
watch(
  () => store.preferences.get('sync'),
  (newConfig) => {
    autoSync.value = newConfig.autoSync
    lastSyncAt.value = newConfig.lastSyncAt
  },
  { deep: true },
)
</script>

<template>
  <div
    v-if="isVisible"
    class="fixed right-3 bottom-3 z-40"
  >
    <div
      class="bg-background/80 border-border flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs shadow-sm backdrop-blur-sm"
      :title="tooltipText"
    >
      <component
        :is="statusIcon"
        class="h-3.5 w-3.5"
        :class="[
          statusColor,
          currentStatus === 'syncing' ? 'animate-spin' : '',
        ]"
      />
      <span
        v-if="currentStatus !== 'idle'"
        class="max-w-[120px] truncate"
        :class="statusColor"
      >
        {{
          currentStatus === "syncing"
            ? i18n.t("preferences:sync.syncing")
            : currentStatus === "error"
              ? i18n.t("preferences:sync.status.failed")
              : i18n.t("preferences:sync.status.success")
        }}
      </span>
      <span
        v-else-if="formattedLastSync"
        class="text-muted-foreground"
      >
        {{ formattedLastSync }}
      </span>
    </div>
  </div>
</template>
