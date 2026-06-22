import type { VaultDoctorResponse } from '~/renderer/services/api/generated'
import { api } from '~/renderer/services/api'

type ConflictGroup = VaultDoctorResponse['conflictGroups'][number]

// 冲突 sonner 通知的稳定 id：切换 vault 时可移除旧 vault 的残留通知。
export const VAULT_DOCTOR_NOTICE_ID = 'vault-doctor-conflicts'

// 云同步冲突副本启发式：Dropbox "(conflicted copy)"、
//  macOS "— copy"、通用 "copy"。仅用于 UI 提示与 canonical 预选，不影响 backend。
const COPY_RE = /(?:—|-)\s*копия|\bкопия\b|\bcopy\b|conflict/i

// Module 级共享状态：启动检查（App.vue）与 Vault Doctor（Storage.vue）
// 复用同一份报告，避免重复扫描。
const report = shallowRef<VaultDoctorResponse | null>(null)
const decisionByGroupId = reactive<Record<string, string>>({})
const isScanning = ref(false)
const isApplying = ref(false)

function splitPath(value: string): { dir: string, name: string } {
  const index = value.lastIndexOf('/')
  if (index === -1) {
    return { dir: '', name: value }
  }

  return { dir: value.slice(0, index + 1), name: value.slice(index + 1) }
}

function isCopyPath(path: string): boolean {
  return COPY_RE.test(splitPath(path).name)
}

// 推荐 canonical：第一个无副本特征的文件，否则取名称最短者（可能是原件），
// 否则取组内第一个。
function getCanonicalPath(group: ConflictGroup): string {
  const original = group.items.find(item => !isCopyPath(item.path))
  if (original) {
    return original.path
  }

  return (
    [...group.items].sort(
      (a, b) => splitPath(a.path).name.length - splitPath(b.path).name.length,
    )[0]?.path ?? group.items[0]?.path
  )
}

function resetDecisions() {
  Object.keys(decisionByGroupId).forEach((groupId) => {
    delete decisionByGroupId[groupId]
  })
}

function preselectDecisions(value: VaultDoctorResponse) {
  value.conflictGroups
    .filter(group => group.reason === 'duplicate-id')
    .forEach((group) => {
      decisionByGroupId[group.id] = getCanonicalPath(group)
    })
}

export function useVaultDoctor() {
  const hasReport = computed(() => !!report.value)

  const safeFixesCount = computed(
    () =>
      report.value?.items.filter(item => item.status === 'pending').length
      ?? 0,
  )

  const blockedCount = computed(() => report.value?.summary.blocked ?? 0)

  const conflictCount = computed(() => report.value?.summary.conflicts ?? 0)

  const duplicateGroups = computed(
    () =>
      report.value?.conflictGroups.filter(
        group => group.reason === 'duplicate-id',
      ) ?? [],
  )

  const selectedDecisionCount = computed(
    () =>
      duplicateGroups.value.filter(group => !!decisionByGroupId[group.id])
        .length,
  )

  const warningPreview = computed(
    () => report.value?.warnings.slice(0, 5) ?? [],
  )

  const hiddenWarningCount = computed(() => {
    const total = report.value?.warnings.length ?? 0
    return Math.max(0, total - warningPreview.value.length)
  })

  const canApply = computed(
    () => safeFixesCount.value > 0 || selectedDecisionCount.value > 0,
  )

  function selectDecision(groupId: string, keepPath: string) {
    decisionByGroupId[groupId] = keepPath
  }

  function isDecisionSelected(groupId: string, path: string): boolean {
    return decisionByGroupId[groupId] === path
  }

  function getDecisionReassignCount(group: ConflictGroup): number {
    return decisionByGroupId[group.id] ? group.items.length - 1 : 0
  }

  function getConflictId(group: ConflictGroup): string {
    return group.id.split(':').at(-1) ?? group.id
  }

  // 返回报告。错误向上抛出——由调用方决定如何展示（启动时静默，设置页用 sonner）。
  async function scan(): Promise<VaultDoctorResponse | null> {
    if (isScanning.value || isApplying.value) {
      return report.value
    }

    isScanning.value = true

    try {
      const { data } = await api.system.postSystemVaultDoctorPreview({})
      resetDecisions()
      preselectDecisions(data)
      report.value = data
      return data
    }
    finally {
      isScanning.value = false
    }
  }

  // 重置报告与决策。切换 vault 时需要：旧报告对应旧路径，不适用于新 vault。
  function reset() {
    report.value = null
    resetDecisions()
  }

  async function apply(): Promise<VaultDoctorResponse> {
    isApplying.value = true

    try {
      const decisions = Object.entries(decisionByGroupId).map(
        ([groupId, keepPath]) => ({ groupId, keepPath }),
      )
      const { data } = await api.system.postSystemVaultDoctorApply({
        decisions,
      })
      resetDecisions()
      report.value = data
      return data
    }
    finally {
      isApplying.value = false
    }
  }

  return {
    report,
    decisionByGroupId,
    isScanning,
    isApplying,
    hasReport,
    safeFixesCount,
    blockedCount,
    conflictCount,
    duplicateGroups,
    selectedDecisionCount,
    warningPreview,
    hiddenWarningCount,
    canApply,
    splitPath,
    isCopyPath,
    getConflictId,
    getDecisionReassignCount,
    selectDecision,
    isDecisionSelected,
    scan,
    apply,
    reset,
  }
}
