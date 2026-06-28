<script setup lang="ts">
import { useAiPrototypeSettings } from '@/composables/spaces/aiPrototype/useAiPrototypeSettings'
import { i18n } from '@/electron'

const { settings } = useAiPrototypeSettings()
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('preferences:aiPrototype.label')">
      <UiMenuFormItem
        :label="i18n.t('preferences:aiPrototype.cursorApiKey.label')"
      >
        <input
          v-model="settings.cursorApiKey"
          type="password"
          class="border-input bg-background h-8 w-full max-w-md rounded-md border px-2 text-sm"
          autocomplete="off"
        >
        <template #description>
          {{ i18n.t("preferences:aiPrototype.cursorApiKey.description") }}
        </template>
      </UiMenuFormItem>

      <UiMenuFormItem
        :label="i18n.t('preferences:aiPrototype.cursorModel.label')"
      >
        <input
          v-model="settings.cursorModel"
          type="text"
          class="border-input bg-background h-8 w-full max-w-md rounded-md border px-2 text-sm"
        >
        <template #description>
          {{ i18n.t("preferences:aiPrototype.cursorModel.description") }}
        </template>
      </UiMenuFormItem>

      <UiMenuFormItem :label="i18n.t('preferences:aiPrototype.apiKey.label')">
        <input
          v-model="settings.apiKey"
          type="password"
          class="border-input bg-background h-8 w-full max-w-md rounded-md border px-2 text-sm"
          autocomplete="off"
        >
        <template #description>
          {{ i18n.t("preferences:aiPrototype.apiKey.description") }}
        </template>
      </UiMenuFormItem>

      <UiMenuFormItem
        :label="i18n.t('preferences:aiPrototype.defaultAspectRatio.label')"
      >
        <input
          v-model="settings.defaultAspectRatio"
          type="text"
          class="border-input bg-background h-8 w-full max-w-md rounded-md border px-2 text-sm"
        >
        <template #description>
          {{ i18n.t("preferences:aiPrototype.defaultAspectRatio.description") }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
