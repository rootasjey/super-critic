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

const BASE_WIDTH = 1280
const BASE_HEIGHT = 720

const container = ref<HTMLElement | null>(null)
let game: Phaser.Game | null = null
const debugStore = useDebugStore()

const { on, off, emit } = useEventBus()

function createPhaserGame(parent: HTMLElement) {
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
      mode: Phaser.Scale.FIT,
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: true,
      antialias: false,
    },
  }

  return new Phaser.Game(config)
}

function onStart() {
  if (!game && container.value) {
    game = createPhaserGame(container.value)

    // Set StageScene instance on the debug store for debug tools to attach
    try {
      const scene = game.scene.getScenes().find((s: any) => s instanceof StageScene) as any
      if (scene) debugStore.phaserScene = scene
    } catch {}
  }
}

function onStop() {
  if (game) {
    game.destroy(true)
    game = null
    try { debugStore.phaserScene = null } catch {}
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
  const scene = game?.scene.getScenes().find((s: any) => s instanceof StageScene) as any
    if (scene) {
      scene.debugEnabled = debugStore.enabled
      scene.player.debugEnabled = debugStore.enabled && debugStore.playerCollider
      if (scene.debugText) scene.debugText.setVisible(debugStore.enabled && debugStore.playerCollider)
      if (scene.debugGfx) scene.debugGfx.clear()
      if (scene.platformsDebugGfx) scene.platformsDebugGfx.clear()
    }
  })
  watch(() => debugStore.playerCollider, () => {
    const scene = game?.scene.getScenes().find((s: any) => s instanceof StageScene) as any
    if (scene && scene.player) {
      scene.player.debugEnabled = debugStore.enabled && debugStore.playerCollider
      if (scene.debugText) scene.debugText.setVisible(debugStore.enabled && debugStore.playerCollider)
      if (scene.debugGfx) scene.debugGfx.clear()
    }
  })
  watch(() => debugStore.platformsCollider, () => {
    const scene = game?.scene.getScenes().find((s: any) => s instanceof StageScene) as any
    if (scene && scene.platformsDebugGfx) {
      scene.platformsDebugGfx.clear()
    }
  })
})

onBeforeUnmount(() => {
  off('vue:start', onStart)
  off('vue:stop', onStop)
  onStop()
})
</script>

<style scoped>
.game-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #080808;
}
</style>
