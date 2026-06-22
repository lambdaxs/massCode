<script setup lang="ts">
import { i18n } from '@/electron'
import { version } from '../../../../package.json'
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('preferences:updates.label')">
      <UiMenuFormItem :label="i18n.t('preferences:updates.version.label')">
        <UiText
          as="div"
          variant="base"
        >
          v{{ version }}
        </UiText>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
