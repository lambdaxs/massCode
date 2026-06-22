<script setup lang="ts">
import { useAiPrototype } from '@/composables/spaces/aiPrototype/useAiPrototype'
import { useAiPrototypeSettings } from '@/composables/spaces/aiPrototype/useAiPrototypeSettings'
import { i18n } from '@/electron'
import { ImagePlus, Send, X } from 'lucide-vue-next'

const { messages, activeSession, isSending, isGenerating, sendMessage }
  = useAiPrototype()
const { settings } = useAiPrototypeSettings()

const prompt = ref('')
const pendingUploads = ref<
  Array<{
    name: string
    mimeType: string
    previewUrl: string
    base64: string
  }>
>([])

const canSend = computed(() => {
  return (
    Boolean(prompt.value.trim())
    && !isSending.value
    && !isGenerating.value
    && activeSession.value
  )
})

async function readFileAsUpload(file: File) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  pendingUploads.value.push({
    name: file.name,
    mimeType: file.type || 'image/png',
    previewUrl: URL.createObjectURL(file),
    base64: btoa(binary),
  })
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? [...input.files] : []
  input.value = ''

  for (const file of files.slice(0, 4 - pendingUploads.value.length)) {
    await readFileAsUpload(file)
  }
}

function removeUpload(index: number) {
  const item = pendingUploads.value[index]
  if (item?.previewUrl) {
    URL.revokeObjectURL(item.previewUrl)
  }
  pendingUploads.value.splice(index, 1)
}

async function onSend() {
  if (!canSend.value) {
    return
  }

  await sendMessage({
    prompt: prompt.value.trim(),
    aspectRatio: settings.defaultAspectRatio,
    uploads: pendingUploads.value.map(item => ({
      name: item.name,
      mimeType: item.mimeType,
      base64: item.base64,
    })),
  })

  prompt.value = ''
  pendingUploads.value.forEach(item => URL.revokeObjectURL(item.previewUrl))
  pendingUploads.value = []
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
      <AiPrototypeMessageBubble
        v-for="message in messages"
        :key="message.id"
        :message="message"
      />
    </div>

    <div class="border-border border-t px-4 py-3">
      <div
        v-if="pendingUploads.length"
        class="mb-2 flex flex-wrap gap-2"
      >
        <div
          v-for="(upload, index) in pendingUploads"
          :key="`${upload.name}-${index}`"
          class="relative"
        >
          <img
            :src="upload.previewUrl"
            class="h-14 w-14 rounded-md object-cover"
            alt=""
          >
          <button
            type="button"
            class="bg-background absolute -top-1 -right-1 rounded-full border p-0.5"
            @click="removeUpload(index)"
          >
            <X class="h-3 w-3" />
          </button>
        </div>
      </div>

      <div
        class="border-input bg-background flex items-end gap-2 rounded-xl border px-3 py-2"
      >
        <label class="cursor-pointer">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="hidden"
            multiple
            @change="onFilesSelected"
          >
          <ImagePlus class="text-muted-foreground h-4 w-4" />
        </label>

        <textarea
          v-model="prompt"
          rows="2"
          class="placeholder:text-muted-foreground min-h-[44px] flex-1 resize-none bg-transparent text-sm outline-none"
          :placeholder="i18n.t('spaces.aiPrototype.promptPlaceholder')"
          @keydown.enter.exact.prevent="onSend"
        />

        <UiActionButton
          :tooltip="i18n.t('spaces.aiPrototype.send')"
          :disabled="!canSend"
          @click="onSend"
        >
          <Send class="h-4 w-4" />
        </UiActionButton>
      </div>
    </div>
  </div>
</template>
