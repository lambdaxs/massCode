<script setup lang="ts">
import type { AiPrototypeMessage } from '~/shared/aiPrototype'
import { useAiPrototype } from '@/composables/spaces/aiPrototype/useAiPrototype'
import { i18n } from '@/electron'

const props = defineProps<{
  message: AiPrototypeMessage
}>()

const { activeSessionId, getAssetDataUrl } = useAiPrototype()

const uploadUrls = ref<string[]>([])
const outputAssets = ref<Array<{ assetId: string, url: string }>>([])

const statusLabel = computed(() => {
  if (!props.message.status) {
    return ''
  }

  return i18n.t(`spaces.aiPrototype.status.${props.message.status}`)
})

const errorLabel = computed(() => {
  const error = props.message.error?.trim()
  if (!error) {
    return ''
  }

  const knownKey = `spaces.aiPrototype.errors.${error}`
  if (i18n.t(knownKey) !== knownKey) {
    return i18n.t(knownKey)
  }

  if (
    error.startsWith('GENERATE_FAILED:')
    || error.startsWith('RESULT_FAILED:')
    || error.startsWith('DOWNLOAD_FAILED:')
  ) {
    const code = error.split(':')[0] ?? error
    const codeKey = `spaces.aiPrototype.errors.${code}`
    if (i18n.t(codeKey) !== codeKey) {
      return i18n.t(codeKey)
    }
  }

  return error
})

watch(
  () => [
    props.message.id,
    props.message.uploadAssetIds,
    props.message.outputAssetIds,
    activeSessionId.value,
  ],
  async () => {
    uploadUrls.value = []
    outputAssets.value = []

    if (!activeSessionId.value) {
      return
    }

    for (const assetId of props.message.uploadAssetIds ?? []) {
      const url = await getAssetDataUrl(
        activeSessionId.value,
        assetId,
        'uploads',
      )
      if (url) {
        uploadUrls.value.push(url)
      }
    }

    for (const assetId of props.message.outputAssetIds ?? []) {
      const url = await getAssetDataUrl(
        activeSessionId.value,
        assetId,
        'outputs',
      )
      if (url) {
        outputAssets.value.push({ assetId, url })
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="flex"
    :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[85%] rounded-xl px-3 py-2 text-xs shadow-sm"
      :class="
        message.role === 'user'
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-foreground'
      "
    >
      <div
        v-if="message.prompt"
        class="whitespace-pre-wrap"
      >
        {{ message.prompt }}
      </div>

      <div
        v-if="uploadUrls.length"
        class="mt-2 flex flex-wrap gap-2"
      >
        <img
          v-for="(url, index) in uploadUrls"
          :key="`${message.id}-upload-${index}`"
          :src="url"
          class="h-16 w-16 rounded-md object-cover"
          alt=""
        >
      </div>

      <div
        v-if="message.role === 'assistant'"
        class="space-y-2"
      >
        <div
          v-if="message.status && message.status !== 'succeeded'"
          class="text-muted-foreground"
        >
          {{ statusLabel }}
          <span v-if="typeof message.progress === 'number'">
            · {{ message.progress }}%</span>
        </div>

        <div
          v-if="errorLabel"
          class="text-destructive"
        >
          {{ errorLabel }}
        </div>

        <div
          v-if="outputAssets.length"
          class="flex flex-wrap gap-2"
        >
          <AiPrototypeImage
            v-for="asset in outputAssets"
            :key="`${message.id}-output-${asset.assetId}`"
            :src="asset.url"
            :asset-id="asset.assetId"
          />
        </div>
      </div>
    </div>
  </div>
</template>
