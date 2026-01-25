<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { Switch } from '@/components/ui/shadcn/switch'
import { useDialog, useSonner } from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { format } from 'date-fns'
import { api } from '~/renderer/services/api'

const { sonner } = useSonner()
const { confirm } = useDialog()

const syncConfig = store.preferences.get('sync')
const serverUrl = ref(syncConfig.serverUrl || '')
const token = ref(syncConfig.token || '')
const autoSync = ref(syncConfig.autoSync || false)
const syncOnStartup = ref(syncConfig.syncOnStartup ?? true)
const debounceDelay = ref(syncConfig.debounceDelay || 3000)
const lastSyncAt = ref(syncConfig.lastSyncAt || 0)

const isSyncing = ref(false)
const isTesting = ref(false)
const syncStats = ref<{
  pushed?: { folders: number, snippets: number, tags: number }
  pulled?: { folders: number, snippets: number, tags: number }
} | null>(null)

const isConfigured = computed(() => {
  return !!serverUrl.value && !!token.value
})

const formattedLastSync = computed(() => {
  if (!lastSyncAt.value)
    return i18n.t('preferences:sync.never')
  return format(lastSyncAt.value, 'yyyy-MM-dd HH:mm:ss')
})

// Debounce delay options (in ms)
const debounceOptions = [
  { value: 1000, label: '1s' },
  { value: 2000, label: '2s' },
  { value: 3000, label: '3s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
]

async function saveSettings() {
  try {
    await api.sync.putSyncSettings({
      serverUrl: serverUrl.value,
      token: token.value,
      autoSync: autoSync.value,
    })
    store.preferences.set('sync.serverUrl', serverUrl.value)
    store.preferences.set('sync.token', token.value)
    store.preferences.set('sync.autoSync', autoSync.value)
    store.preferences.set('sync.syncOnStartup', syncOnStartup.value)
    store.preferences.set('sync.debounceDelay', debounceDelay.value)

    // Notify main process to restart scheduler
    ipc.invoke('sync:restart-scheduler')
  }
  catch (err) {
    const e = err as Error
    sonner({ message: e.message, type: 'error' })
  }
}

async function testConnection() {
  if (!isConfigured.value) {
    sonner({
      message: i18n.t('preferences:sync.notConfigured'),
      type: 'warning',
    })
    return
  }

  await saveSettings()
  isTesting.value = true

  try {
    const { data } = await api.sync.postSyncTestConnection()
    if (data.success) {
      sonner({
        message: i18n.t('preferences:sync.status.connectionSuccess'),
        type: 'success',
      })
    }
    else {
      sonner({
        message: `${i18n.t('preferences:sync.status.connectionFailed')}: ${data.message}`,
        type: 'error',
      })
    }
  }
  catch (err) {
    const e = err as Error
    sonner({ message: e.message, type: 'error' })
  }
  finally {
    isTesting.value = false
  }
}

async function syncNow() {
  if (!isConfigured.value) {
    sonner({
      message: i18n.t('preferences:sync.notConfigured'),
      type: 'warning',
    })
    return
  }

  await saveSettings()
  isSyncing.value = true
  syncStats.value = null

  try {
    const { data } = await api.sync.postSyncIncremental()
    if (data.success) {
      lastSyncAt.value = data.syncedAt || Date.now()
      store.preferences.set('sync.lastSyncAt', lastSyncAt.value)

      if (data.stats) {
        syncStats.value = {
          pushed: {
            folders: data.stats.pushed.folders,
            snippets: data.stats.pushed.snippets,
            tags: data.stats.pushed.tags,
          },
          pulled: {
            folders: data.stats.pulled.folders,
            snippets: data.stats.pulled.snippets,
            tags: data.stats.pulled.tags,
          },
        }
      }

      sonner({
        message: i18n.t('preferences:sync.status.success'),
        type: 'success',
      })
    }
    else {
      sonner({
        message: `${i18n.t('preferences:sync.status.failed')}: ${data.message}`,
        type: 'error',
      })
    }
  }
  catch (err) {
    const e = err as Error
    sonner({ message: e.message, type: 'error' })
  }
  finally {
    isSyncing.value = false
  }
}

async function fullSync() {
  if (!isConfigured.value) {
    sonner({
      message: i18n.t('preferences:sync.notConfigured'),
      type: 'warning',
    })
    return
  }

  const isConfirmed = await confirm({
    title: i18n.t('preferences:sync.fullSync'),
    content: i18n.t('preferences:sync.confirm.fullSync'),
  })

  if (!isConfirmed)
    return

  await saveSettings()
  isSyncing.value = true
  syncStats.value = null

  try {
    const { data } = await api.sync.postSyncFull()
    if (data.success) {
      lastSyncAt.value = data.syncedAt || Date.now()
      store.preferences.set('sync.lastSyncAt', lastSyncAt.value)

      if (data.stats) {
        syncStats.value = {
          pushed: {
            folders: 0,
            snippets: 0,
            tags: 0,
          },
          pulled: {
            folders: data.stats.pulled.folders,
            snippets: data.stats.pulled.snippets,
            tags: data.stats.pulled.tags,
          },
        }
      }

      sonner({
        message: i18n.t('preferences:sync.status.success'),
        type: 'success',
      })
    }
    else {
      sonner({
        message: `${i18n.t('preferences:sync.status.failed')}: ${data.message}`,
        type: 'error',
      })
    }
  }
  catch (err) {
    const e = err as Error
    sonner({ message: e.message, type: 'error' })
  }
  finally {
    isSyncing.value = false
  }
}

function onAutoSyncChange(value: boolean) {
  autoSync.value = value
  saveSettings()
}

function onSyncOnStartupChange(value: boolean) {
  syncOnStartup.value = value
  saveSettings()
}

function onDebounceDelayChange(value: string) {
  debounceDelay.value = Number(value)
  saveSettings()
}

// Watch for input changes to save settings
watch([serverUrl, token], () => {
  // Debounce save
  const timeout = setTimeout(() => {
    saveSettings()
  }, 500)
  return () => clearTimeout(timeout)
})
</script>

<template>
  <div class="space-y-5">
    <UiMenuFormSection :label="i18n.t('preferences:sync.label')">
      <UiMenuFormItem :label="i18n.t('preferences:sync.serverUrl')">
        <UiInput
          v-model="serverUrl"
          size="sm"
          :placeholder="i18n.t('preferences:sync.serverUrlPlaceholder')"
        />
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:sync.token')">
        <UiInput
          v-model="token"
          size="sm"
          type="password"
          :placeholder="i18n.t('preferences:sync.tokenPlaceholder')"
        />
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:sync.autoSync')">
        <Switch
          :checked="autoSync"
          @update:checked="onAutoSyncChange"
        />
      </UiMenuFormItem>
      <UiMenuFormItem
        v-if="autoSync"
        :label="i18n.t('preferences:sync.syncOnStartup')"
      >
        <Switch
          :checked="syncOnStartup"
          @update:checked="onSyncOnStartupChange"
        />
      </UiMenuFormItem>
      <UiMenuFormItem
        v-if="autoSync"
        :label="i18n.t('preferences:sync.debounceDelay')"
      >
        <Select.Select
          :model-value="String(debounceDelay)"
          @update:model-value="onDebounceDelayChange"
        >
          <Select.SelectTrigger class="w-[100px]">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="opt in debounceOptions"
              :key="opt.value"
              :value="String(opt.value)"
            >
              {{ opt.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:sync.lastSyncAt')">
        <span class="text-muted-foreground text-sm tabular-nums">
          {{ formattedLastSync }}
        </span>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:sync.testConnection')">
        <UiButton
          size="md"
          :disabled="!isConfigured || isTesting"
          @click="testConnection"
        >
          {{
            isTesting
              ? i18n.t("preferences:sync.testing")
              : i18n.t("preferences:sync.testConnection")
          }}
        </UiButton>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:sync.syncNow')">
        <div class="flex gap-2">
          <UiButton
            size="md"
            :disabled="!isConfigured || isSyncing"
            @click="syncNow"
          >
            {{
              isSyncing
                ? i18n.t("preferences:sync.syncing")
                : i18n.t("preferences:sync.syncNow")
            }}
          </UiButton>
          <UiButton
            size="md"
            variant="danger"
            :disabled="!isConfigured || isSyncing"
            @click="fullSync"
          >
            {{ i18n.t("preferences:sync.fullSync") }}
          </UiButton>
        </div>
      </UiMenuFormItem>

      <!-- Sync Stats -->
      <UiMenuFormItem
        v-if="syncStats"
        label=""
      >
        <div class="border-border space-y-2 rounded-lg border p-3 text-sm">
          <div v-if="syncStats.pushed">
            <span class="font-medium">{{ i18n.t("preferences:sync.stats.pushed") }}:</span>
            {{ syncStats.pushed.folders }}
            {{ i18n.t("preferences:sync.stats.folders") }},
            {{ syncStats.pushed.snippets }}
            {{ i18n.t("preferences:sync.stats.snippets") }},
            {{ syncStats.pushed.tags }}
            {{ i18n.t("preferences:sync.stats.tags") }}
          </div>
          <div v-if="syncStats.pulled">
            <span class="font-medium">{{ i18n.t("preferences:sync.stats.pulled") }}:</span>
            {{ syncStats.pulled.folders }}
            {{ i18n.t("preferences:sync.stats.folders") }},
            {{ syncStats.pulled.snippets }}
            {{ i18n.t("preferences:sync.stats.snippets") }},
            {{ syncStats.pulled.tags }}
            {{ i18n.t("preferences:sync.stats.tags") }}
          </div>
        </div>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
