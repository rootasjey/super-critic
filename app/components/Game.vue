<template>
  <div ref="container" class="game-container" style="position:relative">
    <GameDebug />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import Phaser from 'phaser'
import { useEventBus } from '~/composables/useEventBus'
import { StageScene } from '~/game/scenes/StageScene'
import GameDebug from '~/components/GameDebug.vue'
import { useDebugStore } from '@/stores/debug'

const container = ref<HTMLElement | null>(null)
let game: Phaser.Game | null = null
let resizeHandler: (() => void) | null = null
const debugStore = useDebugStore()

const { on, off, emit } = useEventBus()

function createPhaserGame(parent: HTMLElement) {
  // initial size: fill parent/container (fallback to window)
  const w = Math.max(200, Math.floor(parent.clientWidth || window.innerWidth))
  const h = Math.max(150, Math.floor(parent.clientHeight || window.innerHeight))

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#2d2d2d',
    scene: [StageScene],
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 800 },
        debug: false
      }
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: w,
      height: h,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  }

  return new Phaser.Game(config)
}

function onStart() {
  if (!game && container.value) {
    game = createPhaserGame(container.value)

    resizeHandler = () => {
      if (game && container.value) {
        const w = Math.max(200, Math.floor(container.value.clientWidth || window.innerWidth))
        const h = Math.max(150, Math.floor(container.value.clientHeight || window.innerHeight))
        game.scale.resize(w, h)
        const scene = game.scene.getScene('StageScene') as any
        if (scene && scene.cameras && scene.map) {
          const map = scene.map
          const cam = scene.cameras.main
          const fitZoom = Math.min(w / map.widthInPixels, h / map.heightInPixels)
          cam.setZoom(fitZoom)
          cam.centerOn(map.widthInPixels / 2, map.heightInPixels / 2)
        }
      }
    }

    window.addEventListener('resize', resizeHandler)
    resizeHandler()
  }
}

function onStop() {
  if (game) {
    game.destroy(true)
    game = null
  }
}

onMounted(() => {
  on('vue:start', onStart)
  on('vue:stop', onStop)
  if (container.value) onStart()

  // Toggle debug from query
  try {
    const params = new URLSearchParams(window.location.search)
    debugStore.enabled = (params.get('debug') === 'true')
  } catch {}

  // Sync store changes to active scene if present
  watch(() => debugStore.enabled, () => {
    const scene = game?.scene.getScene('StageScene') as any
    if (scene) {
      scene.debugEnabled = debugStore.enabled
      scene.player.debugEnabled = debugStore.enabled && debugStore.playerCollider
      if (scene.debugText) scene.debugText.setVisible(debugStore.enabled && debugStore.playerCollider)
      if (scene.debugGfx) scene.debugGfx.clear()
      if (scene.platformsDebugGfx) scene.platformsDebugGfx.clear()
    }
  })
  watch(() => debugStore.playerCollider, () => {
    const scene = game?.scene.getScene('StageScene') as any
    if (scene && scene.player) {
      scene.player.debugEnabled = debugStore.enabled && debugStore.playerCollider
      if (scene.debugText) scene.debugText.setVisible(debugStore.enabled && debugStore.playerCollider)
      if (scene.debugGfx) scene.debugGfx.clear()
    }
  })
  watch(() => debugStore.platformsCollider, () => {
    const scene = game?.scene.getScene('StageScene') as any
    if (scene && scene.platformsDebugGfx) {
      scene.platformsDebugGfx.clear()
    }
  })
})

onBeforeUnmount(() => {
  off('vue:start', onStart)
  off('vue:stop', onStop)
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    resizeHandler = null
  }
  onStop()
})
</script>

<style scoped>
.game-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
