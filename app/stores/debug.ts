import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { ref, watch } from 'vue'
import type { StageScene } from '~/game/scenes/StageScene'
import { DEFAULT_SKIN_ID, resolvePlayerSkinDefinition } from '~/game/skins'
import type { AttackOverrideConfig } from '~/game/systems/attack'

export const useDebugStore = defineStore('debug', () => {
  const enabled = useStorage<boolean>('debug-enabled', false)
  const playerCollider = useStorage<boolean>('debug-player-collider', false)
  const platformsCollider = useStorage<boolean>('debug-platforms-collider', false)
  const showEnemiesBody = useStorage<boolean>('debug-enemies-body', false)

  const selectedSkinId = useStorage<string>('debug-selected-skin', DEFAULT_SKIN_ID)
  const skinOverrides = useStorage<Record<string, AttackOverrideConfig | null>>('debug-skin-overrides', {})

  // Typed StageScene reference for debug tooling
  const phaserScene = ref<StageScene | null>(null)

  const applySkinSelection = (id: string, overrides?: AttackOverrideConfig | null) => {
    const scene = phaserScene.value
    if (!scene) return
    const desiredOverrides = overrides === undefined ? skinOverrides.value[id] ?? undefined : overrides
    if (typeof scene.getCurrentSkinDefinition === 'function') {
      const current = scene.getCurrentSkinDefinition()
      if (current?.id === id && desiredOverrides === undefined) return
    }
    scene.changePlayerSkin(resolvePlayerSkinDefinition(id), {
      overrides: desiredOverrides,
    })
  }

  const setSelectedSkin = (id: string) => {
    selectedSkinId.value = id
    applySkinSelection(id)
  }

  const setSkinOverrides = (id: string, overrides: AttackOverrideConfig | null) => {
    const next = { ...skinOverrides.value }
    if (overrides && Object.keys(overrides).length > 0) {
      next[id] = overrides
    } else {
      delete next[id]
    }
    skinOverrides.value = next
    applySkinSelection(id, overrides ?? null)
  }

  const resetSkinOverrides = (id: string) => {
    const next = { ...skinOverrides.value }
    delete next[id]
    skinOverrides.value = next
    applySkinSelection(id, null)
  }

  const getOverridesForSkin = (id: string): AttackOverrideConfig | null => {
    const value = skinOverrides.value[id]
    return value && Object.keys(value).length > 0 ? value : null
  }

  watch(phaserScene, (scene) => {
    if (scene) {
      applySkinSelection(selectedSkinId.value)
    }
  })

  return {
    enabled,
    playerCollider,
    platformsCollider,
    showEnemiesBody,
    phaserScene,
    selectedSkinId,
    skinOverrides,
    setSelectedSkin,
    setSkinOverrides,
    resetSkinOverrides,
    getOverridesForSkin,
  }
})
