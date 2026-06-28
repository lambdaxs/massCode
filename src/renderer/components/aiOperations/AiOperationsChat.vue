<script setup lang="ts">
import type { AiOperationsChatMode } from '~/shared/aiOperations'
import { useSonner } from '@/composables'
import { useAiOperations } from '@/composables/spaces/aiOperations/useAiOperations'
import { useAiPrototypeSettings } from '@/composables/spaces/aiPrototype/useAiPrototypeSettings'
import { i18n } from '@/electron'
import {
  Image,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Save,
  X,
} from 'lucide-vue-next'

const {
  messages,
  templates,
  activeSession,
  activeSessionId,
  activeTemplate,
  chatMode,
  isSending,
  isChatRunning,
  isGenerating,
  sendChat,
  generateImage,
  uploadAsset,
  updateSessionTemplate,
} = useAiOperations()
const { settings } = useAiPrototypeSettings()
const { sonner } = useSonner()

const chatInput = ref('')
const isComposing = ref(false)
const uploadAssetIds = ref<string[]>([])
const uploadPreviews = ref<Array<{ assetId: string, url: string }>>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const messagesScrollRef = ref<HTMLElement | null>(null)
const isSaveTemplateOpen = ref(false)

const isReplyPending = computed(() => {
  return chatMode.value === 'write' ? isChatRunning.value : isGenerating.value
})

const sendButtonLabel = computed(() => {
  if (isSending.value) {
    return i18n.t('spaces.aiOperations.actions.sending')
  }

  if (isReplyPending.value) {
    return i18n.t('spaces.aiOperations.status.running')
  }

  return i18n.t('spaces.aiOperations.send')
})

const aspectRatioHint = computed(() => {
  return (
    activeTemplate.value?.defaults?.aspectRatio?.trim()
    || settings.defaultAspectRatio
  )
})

const footerHint = computed(() => {
  if (isReplyPending.value) {
    return i18n.t('spaces.aiOperations.actions.waitForReply')
  }

  if (chatMode.value === 'write') {
    return i18n.t('spaces.aiOperations.actions.enterToSend')
  }

  return i18n.t('spaces.aiOperations.actions.imageHint', {
    ratio: aspectRatioHint.value,
  })
})

function scrollToLatest() {
  nextTick(() => {
    const container = messagesScrollRef.value
    if (!container) {
      return
    }

    container.scrollTop = container.scrollHeight
  })
}

watch(
  () => [messages.value.length, isChatRunning.value, isGenerating.value],
  () => scrollToLatest(),
)

const canSend = computed(() => {
  return (
    Boolean(chatInput.value.trim())
    && !isSending.value
    && !isChatRunning.value
    && !isGenerating.value
    && activeSession.value
  )
})

function setMode(mode: AiOperationsChatMode) {
  chatMode.value = mode
}

async function onTemplateChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  await updateSessionTemplate(value || null)
}

function onChatKeydown(event: KeyboardEvent) {
  if (event.isComposing || isComposing.value) {
    return
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void onSend()
  }
}

async function onSend() {
  if (!canSend.value) {
    return
  }

  const text = chatInput.value.trim()
  chatInput.value = ''

  try {
    if (chatMode.value === 'write') {
      await sendChat(text)
    }
    else {
      await generateImage({
        prompt: text,
        uploadAssetIds: [...uploadAssetIds.value],
        aspectRatio: aspectRatioHint.value,
      })
      uploadAssetIds.value = []
      uploadPreviews.value = []
    }

    scrollToLatest()
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const knownKey = `spaces.aiOperations.errors.${message}`
    sonner({
      message: i18n.t(knownKey) !== knownKey ? i18n.t(knownKey) : message,
      type: 'error',
    })
  }
}

async function onPickFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []

  for (const file of files) {
    try {
      const assetId = await uploadAsset(file)
      if (!assetId) {
        continue
      }

      uploadAssetIds.value.push(assetId)
      const previewUrl = URL.createObjectURL(file)
      uploadPreviews.value.push({ assetId, url: previewUrl })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sonner({ message, type: 'error' })
    }
  }

  input.value = ''
}

function removeUpload(assetId: string) {
  uploadAssetIds.value = uploadAssetIds.value.filter(id => id !== assetId)
  uploadPreviews.value = uploadPreviews.value.filter(
    item => item.assetId !== assetId,
  )
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="border-border space-y-3 border-b px-4 py-3">
      <AiOperationsDeliverablesPanel />
    </div>

    <div
      ref="messagesScrollRef"
      class="scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
    >
      <div
        v-if="!messages.length"
        class="text-muted-foreground py-8 text-center text-sm"
      >
        {{ i18n.t("spaces.aiOperations.chatPlaceholder") }}
      </div>

      <AiOperationsMessageBubble
        v-for="message in messages"
        :key="message.id"
        :message="message"
      />
    </div>

    <div class="border-border space-y-3 border-t px-4 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="bg-muted inline-flex rounded-lg p-0.5">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs"
            :class="chatMode === 'write' ? 'bg-background shadow-sm' : ''"
            @click="setMode('write')"
          >
            <MessageSquare class="h-3.5 w-3.5" />
            {{ i18n.t("spaces.aiOperations.mode.write") }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs"
            :class="chatMode === 'image' ? 'bg-background shadow-sm' : ''"
            @click="setMode('image')"
          >
            <Image class="h-3.5 w-3.5" />
            {{ i18n.t("spaces.aiOperations.mode.image") }}
          </button>
        </div>

        <select
          class="border-input bg-background h-8 max-w-[12rem] rounded-md border px-2 text-xs"
          :value="activeSession?.templateId ?? ''"
          @change="onTemplateChange"
        >
          <option value="">
            {{ i18n.t("spaces.aiOperations.noTemplate") }}
          </option>
          <option
            v-for="template in templates"
            :key="template.id"
            :value="template.id"
          >
            {{ template.name }}
          </option>
        </select>

        <Button
          variant="outline"
          size="sm"
          class="h-8 text-xs"
          @click="isSaveTemplateOpen = true"
        >
          <Save class="mr-1 h-3.5 w-3.5" />
          {{ i18n.t("spaces.aiOperations.templates.saveFromSession") }}
        </Button>
      </div>

      <div
        v-if="chatMode === 'image' && uploadPreviews.length"
        class="flex flex-wrap gap-2"
      >
        <div
          v-for="item in uploadPreviews"
          :key="item.assetId"
          class="relative"
        >
          <img
            :src="item.url"
            class="h-16 w-16 rounded-md object-cover"
            alt=""
          >
          <button
            type="button"
            class="bg-background absolute -top-1 -right-1 rounded-full p-0.5 shadow"
            @click="removeUpload(item.assetId)"
          >
            <X class="h-3 w-3" />
          </button>
        </div>
      </div>

      <div class="flex gap-2">
        <textarea
          v-model="chatInput"
          rows="3"
          class="border-input bg-background focus-visible:ring-ring min-w-0 flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          :placeholder="
            chatMode === 'write'
              ? i18n.t('spaces.aiOperations.writePlaceholder')
              : i18n.t('spaces.aiOperations.imagePlaceholder')
          "
          @compositionstart="isComposing = true"
          @compositionend="isComposing = false"
          @keydown="onChatKeydown"
        />

        <div class="flex shrink-0 flex-col gap-2">
          <Button
            v-if="chatMode === 'image'"
            variant="outline"
            size="icon"
            class="h-9 w-9"
            @click="fileInputRef?.click()"
          >
            <Paperclip class="h-4 w-4" />
          </Button>
          <Button
            class="h-9 px-3"
            :disabled="!canSend"
            @click="onSend"
          >
            <LoaderCircle
              v-if="isSending || isReplyPending"
              class="mr-1.5 h-3.5 w-3.5 animate-spin"
            />
            {{ sendButtonLabel }}
          </Button>
        </div>
      </div>

      <UiText
        as="p"
        size="xs"
        class="text-muted-foreground"
      >
        {{ footerHint }}
      </UiText>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="onPickFiles"
      >
    </div>

    <AiOperationsTemplateDialog
      v-model:open="isSaveTemplateOpen"
      :draft-session-id="activeSessionId"
      :initial-system-prompt="
        activeSession?.templateId
          ? templates.find((item) => item.id === activeSession.templateId)
            ?.systemPrompt
          : undefined
      "
      @saved="(template) => updateSessionTemplate(template.id)"
    />
  </div>
</template>
