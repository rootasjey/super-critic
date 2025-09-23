import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { ref } from 'vue'
import type Phaser from 'phaser'

export const useDebugStore = defineStore('debug', () => {
  const enabled = useStorage<boolean>('debug-enabled', false)
  const playerCollider = useStorage<boolean>('debug-player-collider', false)
  const platformsCollider = useStorage<boolean>('debug-platforms-collider', false)
  const showEnemiesBody = useStorage<boolean>('debug-enemies-body', false)

  // Typed Phaser Scene reference for debug tooling
  const phaserScene = ref<Phaser.Scene | null>(null)

  return { enabled, playerCollider, platformsCollider, showEnemiesBody, phaserScene }
})
