import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

export const useDebugStore = defineStore('debug', () => {
  const enabled = useStorage<boolean>('debug-enabled', false)
  const playerCollider = useStorage<boolean>('debug-player-collider', false)
  const platformsCollider = useStorage<boolean>('debug-platforms-collider', false)
  return { enabled, playerCollider, platformsCollider }
})
