<script setup lang="ts">
import type { NoteFolderTreeItem } from '@/composables/spaces/notes/useNoteFolderTree'
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { LoaderCircle } from 'lucide-vue-next'

const props = defineProps<{
  title?: string
  description?: string
}>()

const emit = defineEmits<{
  confirm: [folderId: number | null]
}>()

const open = defineModel<boolean>('open', { required: true })

const isLoading = ref(false)
const selectedFolderId = ref<number | null>(null)
const folderRows = ref<
  Array<{ id: number | null, name: string, depth: number }>
>([])

function flattenFolders(
  nodes: NoteFolderTreeItem[],
  depth = 0,
): Array<{ id: number, name: string, depth: number }> {
  const rows: Array<{ id: number, name: string, depth: number }> = []

  nodes.forEach((node) => {
    rows.push({ id: node.id, name: node.name, depth })
    if (node.children?.length) {
      rows.push(...flattenFolders(node.children, depth + 1))
    }
  })

  return rows
}

async function loadFolders() {
  isLoading.value = true

  try {
    const { data } = await api.noteFolders.getNoteFoldersTree()
    const folders = flattenFolders(data ?? [])
    folderRows.value = [
      {
        id: null,
        name: i18n.t('common.inbox'),
        depth: 0,
      },
      ...folders,
    ]

    if (
      selectedFolderId.value !== null
      && !folders.some(folder => folder.id === selectedFolderId.value)
    ) {
      selectedFolderId.value = null
    }
  }
  finally {
    isLoading.value = false
  }
}

watch(
  open,
  (value) => {
    if (value) {
      void loadFolders()
    }
  },
  { immediate: true },
)

function onConfirm() {
  emit('confirm', selectedFolderId.value)
}
</script>

<template>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      class="grid max-h-[calc(100dvh-4rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden sm:max-w-md"
      @open-auto-focus="(event) => event.preventDefault()"
    >
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>
          {{ props.title ?? i18n.t("spaces.aiPrototype.export.title") }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription>
          {{
            props.description ?? i18n.t("spaces.aiPrototype.export.description")
          }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>

      <div class="scrollbar min-h-0 overflow-y-auto">
        <div
          v-if="isLoading"
          class="text-muted-foreground flex items-center gap-2 py-6 text-sm"
        >
          <LoaderCircle class="h-4 w-4 animate-spin" />
          {{ i18n.t("spaces.aiPrototype.export.loadingFolders") }}
        </div>

        <div
          v-else
          class="space-y-1"
        >
          <button
            v-for="folder in folderRows"
            :key="folder.id ?? 'inbox'"
            type="button"
            class="hover:bg-accent flex w-full items-center rounded-md px-2 py-2 text-left text-sm transition-colors"
            :class="
              selectedFolderId === folder.id
                ? 'bg-accent text-accent-foreground'
                : ''
            "
            :style="{ paddingLeft: `${8 + folder.depth * 16}px` }"
            @click="selectedFolderId = folder.id"
          >
            <span class="truncate">{{ folder.name }}</span>
          </button>
        </div>
      </div>

      <Dialog.DialogFooter>
        <Button
          variant="outline"
          @click="open = false"
        >
          {{ i18n.t("button.cancel") }}
        </Button>
        <Button
          :disabled="isLoading"
          @click="onConfirm"
        >
          {{ i18n.t("spaces.aiPrototype.export.confirm") }}
        </Button>
      </Dialog.DialogFooter>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
