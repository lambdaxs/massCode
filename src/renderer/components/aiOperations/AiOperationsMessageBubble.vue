<script setup lang="ts">
import type { AiOperationsMessage } from '~/shared/aiOperations'
import { useAiOperations } from '@/composables/spaces/aiOperations/useAiOperations'
import { i18n } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'
import { resolveAiOperationsMessageKind } from '~/shared/aiOperations'

const props = defineProps<{
  message: AiOperationsMessage
}>()

const { activeSessionId, getAssetDataUrl } = useAiOperations()

const messageKind = computed(() =>
  resolveAiOperationsMessageKind(props.message),
)
const uploadUrls = ref<string[]>([])
const outputAssets = ref<Array<{ assetId: string, url: string }>>([])

const isUserBubble = computed(() => props.message.role === 'user')

const isChatPending = computed(() => {
  return (
    props.message.role === 'assistant'
    && messageKind.value === 'chat'
    && props.message.status === 'running'
  )
})

const isImagePending = computed(() => {
  return (
    props.message.role === 'assistant'
    && messageKind.value === 'image-generation'
    && props.message.status
    && props.message.status !== 'succeeded'
  )
})

const bubbleText = computed(() => {
  if (props.message.role === 'user') {
    return props.message.prompt ?? ''
  }

  if (messageKind.value === 'deliverable') {
    return i18n.t('spaces.aiOperations.deliverableCreated', {
      fileName:
        props.message.deliverableFileName ?? props.message.content ?? '',
    })
  }

  return props.message.content ?? ''
})

const statusLabel = computed(() => {
  if (!props.message.status) {
    return ''
  }

  return i18n.t(`spaces.aiOperations.status.${props.message.status}`)
})

const errorLabel = computed(() => {
  const error = props.message.error?.trim()
  if (!error) {
    return ''
  }

  const knownKey = `spaces.aiOperations.errors.${error}`
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
    activeSessionId.value,
    messageKind.value,
  ],
  async () => {
    uploadUrls.value = []
    outputAssets.value = []

    if (!activeSessionId.value || messageKind.value !== 'image-generation') {
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
    :class="isUserBubble ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[min(100%,42rem)] space-y-2 rounded-2xl px-3 py-2 text-sm leading-relaxed"
      :class="
        isUserBubble
          ? 'bg-primary text-primary-foreground'
          : messageKind === 'deliverable'
            ? 'border-border bg-muted/40 border'
            : 'bg-muted/60'
      "
    >
      <div
        v-if="bubbleText"
        class="whitespace-pre-wrap"
      >
        {{ bubbleText }}
      </div>

      <div
        v-if="isChatPending || isImagePending"
        class="text-muted-foreground inline-flex items-center gap-2 text-xs"
      >
        <LoaderCircle
          v-if="
            message.status === 'running'
              || message.status === 'submitting'
              || message.status === 'pending'
          "
          class="h-3.5 w-3.5 animate-spin"
        />
        {{ statusLabel }}
        <span v-if="typeof message.progress === 'number'">
          · {{ message.progress }}%
        </span>
      </div>

      <div
        v-if="uploadUrls.length"
        class="flex flex-wrap gap-2"
      >
        <img
          v-for="(url, index) in uploadUrls"
          :key="`upload-${index}`"
          :src="url"
          class="max-h-24 rounded-md object-cover"
          alt=""
        >
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
          messages-prefix="spaces.aiOperations.image"
        />
      </div>

      <div
        v-if="errorLabel"
        class="text-destructive text-xs"
      >
        {{ errorLabel }}
      </div>
    </div>
  </div>
</template>
