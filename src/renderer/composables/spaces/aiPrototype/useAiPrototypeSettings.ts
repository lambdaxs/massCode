import type { AiPrototypeSettings } from '~/main/store/types'
import { store } from '@/electron'

const settings = reactive(
  store.preferences.get('aiPrototype') as AiPrototypeSettings,
)

watch(
  settings,
  () => {
    store.preferences.set('aiPrototype', JSON.parse(JSON.stringify(settings)))
  },
  { deep: true },
)

export function useAiPrototypeSettings() {
  return {
    settings,
  }
}
