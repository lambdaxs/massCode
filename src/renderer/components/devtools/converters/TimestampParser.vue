<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useCopyToClipboard } from '@/composables'
import { i18n } from '@/electron'
import { Copy } from 'lucide-vue-next'
import { buildTimestampOutputs, parseTimestampInput } from './timestampParser'

const input = ref('')

const title = computed(() =>
  i18n.t('devtools:converters.timestampParser.label'),
)
const description = computed(() =>
  i18n.t('devtools:converters.timestampParser.description'),
)

const copy = useCopyToClipboard()

const parsed = computed(() => parseTimestampInput(input.value))

const detectedUnitLabel = computed(() => {
  if (!parsed.value) {
    return ''
  }

  return i18n.t(
    `devtools:converters.timestampParser.units.${parsed.value.unit}`,
  )
})

const outputFields = computed(() => {
  if (!parsed.value) {
    return []
  }

  return buildTimestampOutputs(parsed.value.date).map(field => ({
    ...field,
    label: i18n.t(`devtools:converters.timestampParser.fields.${field.key}`),
  }))
})

function useCurrentTime() {
  input.value = String(Math.floor(Date.now() / 1000))
}
</script>

<template>
  <div class="space-y-6">
    <UiHeading
      :title="title"
      :description="description"
    />
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <UiHeading
          :title="i18n.t('devtools:form.input')"
          :level="3"
        />
        <Button
          variant="outline"
          size="sm"
          @click="useCurrentTime"
        >
          {{ i18n.t("devtools:converters.timestampParser.useNow") }}
        </Button>
      </div>
      <UiInput
        v-model="input"
        :placeholder="i18n.t('devtools:form.placeholder.timestamp')"
        clearable
      />
    </div>
    <div
      v-if="input.trim() && !parsed"
      class="text-destructive text-sm"
    >
      {{ i18n.t("devtools:converters.timestampParser.errors.invalid") }}
    </div>
    <div
      v-if="parsed"
      class="space-y-4"
    >
      <UiHeading
        :title="i18n.t('devtools:form.result')"
        :level="3"
      />
      <div class="text-muted-foreground text-sm">
        {{ i18n.t("devtools:converters.timestampParser.detectedUnit") }}:
        {{ detectedUnitLabel }}
      </div>
      <div
        class="grid grid-cols-[max-content_1fr_max-content] items-center gap-4"
      >
        <template
          v-for="field in outputFields"
          :key="field.key"
        >
          <UiText
            as="div"
            weight="medium"
          >
            {{ field.label }}
          </UiText>
          <UiInput
            :model-value="field.value"
            readonly
          />
          <Button
            variant="icon"
            size="icon"
            @click="copy(field.value)"
          >
            <Copy />
          </Button>
        </template>
      </div>
    </div>
  </div>
</template>
