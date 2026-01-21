<script setup lang="ts">
import { i18n, ipc } from '@/electron'
import { toast } from 'vue-sonner'

// Sync state
const syncEnabled = ref(false)
const serverUrl = ref('http://localhost:8080')
const email = ref('')
const apiKey = ref('')
const userId = ref('')
const lastSyncTime = ref<number | null>(null)
const isSyncing = ref(false)
const isRegistering = ref(false)

// Load sync status on mount
onMounted(async () => {
  const status = await ipc.invoke('sync:get-status')
  syncEnabled.value = status.enabled
  serverUrl.value = status.serverUrl
  userId.value = status.userId ?? ''
  lastSyncTime.value = status.lastSyncTime
})

// Format timestamp
const formatLastSyncTime = computed(() => {
  if (!lastSyncTime.value)
    return i18n.t('preferences:sync.never')
  return new Date(lastSyncTime.value).toLocaleString()
})

// Enable sync
async function enableSync() {
  if (!apiKey.value || !userId.value) {
    toast.error(i18n.t('preferences:sync.credentialsRequired'))
    return
  }

  const result = await ipc.invoke('sync:enable', {
    serverUrl: serverUrl.value,
    userId: userId.value,
    apiKey: apiKey.value,
  })

  if (result.success) {
    syncEnabled.value = true
    toast.success(i18n.t('preferences:sync.enabled'))
  }
}

// Disable sync
async function disableSync() {
  const result = await ipc.invoke('sync:disable')
  if (result.success) {
    syncEnabled.value = false
    toast.success(i18n.t('preferences:sync.disabled'))
  }
}

// Register new account
async function registerAccount() {
  if (!email.value) {
    toast.error(i18n.t('preferences:sync.emailRequired'))
    return
  }

  isRegistering.value = true
  try {
    const result = await ipc.invoke('sync:register', {
      serverUrl: serverUrl.value,
      email: email.value,
    })

    if (result.success) {
      userId.value = result.data.user_id
      apiKey.value = result.data.api_key
      toast.success(i18n.t('preferences:sync.registerSuccess'))
    }
    else {
      toast.error(result.error || i18n.t('preferences:sync.registerFailed'))
    }
  }
  catch {
    toast.error(i18n.t('preferences:sync.registerFailed'))
  }
  finally {
    isRegistering.value = false
  }
}

// Sync now
async function syncNow() {
  isSyncing.value = true
  try {
    const result = await ipc.invoke('sync:sync-now')

    if (result.success) {
      lastSyncTime.value = Date.now()
      const stats = result.stats
      toast.success(
        i18n.t('preferences:sync.syncSuccess', {
          pulled:
            stats?.foldersPulled + stats?.snippetsPulled + stats?.tagsPulled
            || 0,
          pushed:
            stats?.foldersPushed + stats?.snippetsPushed + stats?.tagsPushed
            || 0,
        }),
      )
    }
    else {
      toast.error(result.error || i18n.t('preferences:sync.syncFailed'))
    }
  }
  catch {
    toast.error(i18n.t('preferences:sync.syncFailed'))
  }
  finally {
    isSyncing.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Server URL -->
    <UiMenuFormItem :label="i18n.t('preferences:sync.serverUrl')">
      <UiInput
        v-model="serverUrl"
        :disabled="syncEnabled"
        placeholder="http://localhost:8080"
        size="sm"
        class="w-80"
      />
      <template #description>
        {{ i18n.t("preferences:sync.serverUrlDescription") }}
      </template>
    </UiMenuFormItem>

    <!-- Sync Toggle -->
    <UiMenuFormItem :label="i18n.t('preferences:sync.enableSync')">
      <div class="flex items-center gap-3">
        <UiSwitch
          :checked="syncEnabled"
          @update:checked="syncEnabled ? disableSync() : enableSync()"
        />
        <span class="text-sm text-neutral-500">
          {{
            syncEnabled
              ? i18n.t("preferences:sync.enabled")
              : i18n.t("preferences:sync.disabled")
          }}
        </span>
      </div>
    </UiMenuFormItem>

    <!-- Registration Section (when sync is disabled) -->
    <template v-if="!syncEnabled">
      <UiMenuFormSection :label="i18n.t('preferences:sync.register')" />
      <UiMenuFormItem :label="i18n.t('preferences:sync.email')">
        <UiInput
          v-model="email"
          :placeholder="i18n.t('preferences:sync.emailPlaceholder')"
          size="sm"
          class="w-80"
        />
        <template #actions>
          <UiButton
            size="md"
            :loading="isRegistering"
            @click="registerAccount"
          >
            {{ i18n.t("preferences:sync.registerButton") }}
          </UiButton>
        </template>
        <template #description>
          {{ i18n.t("preferences:sync.registerDescription") }}
        </template>
      </UiMenuFormItem>

      <!-- API Key (after registration) -->
      <UiMenuFormItem
        v-if="apiKey"
        :label="i18n.t('preferences:sync.apiKey')"
      >
        <UiInput
          v-model="apiKey"
          type="password"
          size="sm"
          class="w-80"
        />
        <template #description>
          {{ i18n.t("preferences:sync.apiKeyDescription") }}
        </template>
      </UiMenuFormItem>

      <!-- User ID (after registration) -->
      <UiMenuFormItem
        v-if="userId"
        :label="i18n.t('preferences:sync.userId')"
      >
        <UiInput
          v-model="userId"
          size="sm"
          class="w-80"
          disabled
        />
      </UiMenuFormItem>
    </template>

    <!-- Sync Status and Actions -->
    <UiMenuFormSection :label="i18n.t('preferences:sync.status')" />
    <UiMenuFormItem :label="i18n.t('preferences:sync.lastSync')">
      <span class="text-sm">{{ formatLastSyncTime }}</span>
      <template #actions>
        <UiButton
          size="md"
          :disabled="!syncEnabled || isSyncing"
          :loading="isSyncing"
          @click="syncNow"
        >
          {{ i18n.t("preferences:sync.syncNow") }}
        </UiButton>
      </template>
    </UiMenuFormItem>

    <!-- Info -->
    <div
      class="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900"
    >
      <h4 class="mb-2 font-medium">
        {{ i18n.t("preferences:sync.info.title") }}
      </h4>
      <ul class="space-y-1 text-neutral-600 dark:text-neutral-400">
        <li>• {{ i18n.t("preferences:sync.info.item1") }}</li>
        <li>• {{ i18n.t("preferences:sync.info.item2") }}</li>
        <li>• {{ i18n.t("preferences:sync.info.item3") }}</li>
      </ul>
    </div>
  </div>
</template>
