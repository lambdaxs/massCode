import type { TagsResponse } from '@/services/api/generated'
import { api } from '@/services/api'

const tags = shallowRef<TagsResponse>([])
const isLoading = ref(false)
const isTagsLoaded = ref(false)
let inFlightRequest: Promise<void> | null = null

// 并行调用（space init + 组件 mount）去重合并为一次请求。
function getTags(): Promise<void> {
  if (inFlightRequest) {
    return inFlightRequest
  }

  inFlightRequest = (async () => {
    try {
      isLoading.value = true
      const { data } = await api.tags.getTags()
      tags.value = data
      isTagsLoaded.value = true
    }
    catch (error) {
      console.error(error)
    }
    finally {
      isLoading.value = false
      inFlightRequest = null
    }
  })()

  return inFlightRequest
}

async function addTag(tagName: string) {
  const { data } = await api.tags.postTags({ name: tagName })

  return data.id as number
}

async function deleteTag(tagId: number) {
  try {
    await api.tags.deleteTagsById(String(tagId))
    await getTags()
  }
  catch (error) {
    console.error(error)
  }
}

export function useTags() {
  return {
    addTag,
    deleteTag,
    getTags,
    isLoading,
    isTagsLoaded,
    tags,
  }
}
