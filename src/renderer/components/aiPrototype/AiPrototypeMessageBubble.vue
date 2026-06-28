<script setup lang="ts">
import type { AiPrototypeMessage } from '~/shared/aiPrototype'
import { useAiPrototype } from '@/composables/spaces/aiPrototype/useAiPrototype'
import { i18n } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'
import { resolveAiPrototypeMessageKind } from '~/shared/aiPrototype'

const props = defineProps<{
  message: AiPrototypeMessage
}>()

const { getAssetDataUrl } = useAiPrototype()

const messageKind = computed(() =>
  resolveAiPrototypeMessageKind(props.message),
)
const uploadUrls = ref<string[]>([])
const outputAssets = ref<Array<{ assetId: string, url: string }>>([])

const isUserBubble = computed(() => props.message.role === 'user')

const bubbleText = computed(() => {
  if (props.message.role === 'user') {
    return props.message.prompt ?? ''
  }

  if (messageKind.value === 'deliverable') {
    return i18n.t('spaces.aiPrototype.deliverableCreated', {
      name: props.message.deliverableId ?? props.message.content ?? '',
    })
  }

  return props.message.content ?? ''
})

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

  return error
})

watch(
  () => [
    props.message.id,
    props.message.uploadAssetIds,
    props.message.outputAssetIds,
    messageKind.value,
  ],
  async () => {
    uploadUrls.value = []
    outputAssets.value = []

    if (messageKind.value !== 'image-generation') {
      return
    }

    for (const assetId of props.message.uploadAssetIds ?? []) {
      const url = await getAssetDataUrl(assetId, 'uploads')
      if (url) {
        uploadUrls.value.push(url)
      }
    }

    for (const assetId of props.message.outputAssetIds ?? []) {
      const url = await getAssetDataUrl(assetId, 'outputs')
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
    :class="isUserBubble ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[85%] rounded-xl px-3 py-2 text-xs shadow-sm"
      :class="
        isUserBubble
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-foreground'
      "
    >
      <div
        v-if="bubbleText"
        class="whitespace-pre-wrap"
      >
        {{ bubbleText }}
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
        v-if="
          message.role === 'assistant' && messageKind === 'image-generation'
        "
        class="space-y-2"
      >
        <div
          v-if="message.status && message.status !== 'succeeded'"
          class="text-muted-foreground inline-flex items-center gap-1"
        >
          <LoaderCircle
            v-if="
              message.status === 'running' || message.status === 'submitting'
            "
            class="h-3 w-3 animate-spin"
          />
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
          <GeneratedImage
            v-for="asset in outputAssets"
            :key="`${message.id}-output-${asset.assetId}`"
            :src="asset.url"
            :asset-id="asset.assetId"
          />
        </div>
      </div>

      <div
        v-else-if="message.role === 'assistant' && message.status === 'running'"
        class="text-muted-foreground mt-1 inline-flex items-center gap-1"
      >
        <LoaderCircle class="h-3 w-3 animate-spin" />
        {{ statusLabel }}
      </div>

      <div
        v-else-if="message.role === 'assistant' && errorLabel"
        class="text-destructive mt-1"
      >
        {{ errorLabel }}
      </div>
    </div>
  </div>
</template>
