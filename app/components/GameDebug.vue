<template>
  <div v-if="debug.enabled" class="debug-panel">
    <div class="header">Game Debug</div>
    <div class="row">
      <label><input type="checkbox" v-model="debug.playerCollider" /> Player collider</label>
    </div>
    <div class="row">
      <label><input type="checkbox" v-model="debug.platformsCollider" /> Platforms colliders</label>
    </div>
    <div class="row">
      <label><input type="checkbox" v-model="debug.showEnemiesBody" /> Enemies body</label>
    </div>
    <div class="row">
      <div><strong>Frame:</strong> {{ frame }}</div>
      <div style="margin-left:8px"><strong>FPS:</strong> {{ fps }}</div>
    </div>
    <div class="row">
      <button type="button" @click="togglePause" class="btn">{{ isPaused ? 'Resume' : 'Pause' }}</button>
      <button type="button" @click="restartScene" class="btn" style="margin-left:8px">Restart</button>
    </div>
  <div class="hint">F1: Pause/Resume, F2: Restart, F3: Toggle in-canvas overlay. Use J/L, I/K, U/O, N/M to adjust player collider. P prints values.</div>
  </div>

</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useDebugStore } from '@/stores/debug'

const debug = useDebugStore()

const frame = ref(0)
const fps = ref(0)

let rafId = 0 as number
let lastFpsTime = 0
let framesThisInterval = 0

let sceneAttached = false
let sceneCleanup: (() => void) | null = null
const isPaused = ref(false)

function setPausedStateFromScene(scene: any) {
  try {
    // Prefer SceneManager lookup
    const mgr = scene.scene
    if (mgr && typeof mgr.isPaused === 'function') {
      const key = (scene && scene.scene && scene.scene.key) || undefined
      if (key) {
        isPaused.value = !!mgr.isPaused(key)
        return
      }
    }
  } catch {}
  try {
    // Fallback: use sys.isPaused flag if present
    isPaused.value = !!scene.sys?.isPaused
  } catch {}
}

function togglePause() {
  console.debug('[GameDebug] togglePause called')
  try {
    const maybeScene = (debug as any).phaserScene
    const scene = maybeScene && typeof maybeScene === 'object' && 'value' in maybeScene ? maybeScene.value : maybeScene
    if (!scene) return
    const mgr = scene.scene
    // Prefer pausing/resuming the scene via ScenePlugin or Scene instance methods
    try {
      const key = (scene && scene.scene && scene.scene.key) || undefined
      if (mgr && typeof mgr.isPaused === 'function' && key) {
        if (mgr.isPaused(key)) mgr.resume(key)
        else mgr.pause(key)
        isPaused.value = !!mgr.isPaused(key)
        return
      }
      // Try instance methods: scene.scene.pause() / resume()
      if (typeof scene.scene.pause === 'function') {
        const currentlyPaused = !!scene.sys?.isPaused
        if (currentlyPaused && typeof scene.scene.resume === 'function') scene.scene.resume()
        else if (typeof scene.scene.pause === 'function') scene.scene.pause()
        isPaused.value = !!scene.sys?.isPaused
        return
      }
    } catch {}
    // Fallback: emit pause/resume events on sys.events
    try {
      if (scene.sys && typeof scene.sys.events !== 'undefined') {
        if (!isPaused.value) {
          scene.sys.events.emit('pause')
          isPaused.value = true
        } else {
          scene.sys.events.emit('resume')
          isPaused.value = false
        }
      }
    } catch {}
  } catch {}
}

function restartScene() {
  try {
    const maybeScene = (debug as any).phaserScene
    const scene = maybeScene && typeof maybeScene === 'object' && 'value' in maybeScene ? maybeScene.value : maybeScene
    if (!scene) return
    const mgr = scene.scene
    try {
      // Prefer restarting via the scene instance
      console.debug('[GameDebug] attempting restart via scene')
      if (typeof scene.scene.restart === 'function') {
        scene.scene.restart()
        return
      }
      const key = (scene && scene.scene && scene.scene.key) || undefined
      if (mgr && typeof mgr.stop === 'function' && typeof mgr.start === 'function' && key) {
        mgr.stop(key)
        mgr.start(key)
        return
      }
    } catch {}
  } catch {}
}

function rafLoop(time: number) {
  frame.value += 1
  framesThisInterval += 1

  if (!lastFpsTime) lastFpsTime = time

  const delta = time - lastFpsTime
  if (delta >= 500) {
    fps.value = Math.round((framesThisInterval * 1000) / delta)
    framesThisInterval = 0
    lastFpsTime = time
  }

  rafId = requestAnimationFrame(rafLoop)
}

onMounted(() => {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('debug') === 'true') debug.enabled = true
  } catch {}

  // Prefer Phaser Scene postupdate when available so frames reflect game ticks
  try {
    const maybeScene = (debug as any).phaserScene
    const scene = maybeScene && typeof maybeScene === 'object' && 'value' in maybeScene ? maybeScene.value : maybeScene
    if (scene && scene.sys && scene.sys.events) {
      sceneAttached = true
      const onPost = () => {
        frame.value += 1
        // Phaser exposes smoothed FPS on the game loop
        fps.value = Math.round(scene.game?.loop?.actualFps || 0)
          setPausedStateFromScene(scene)
      }
      scene.sys.events.on('postupdate', onPost)
      sceneCleanup = () => scene.sys.events.off('postupdate', onPost)
    }
  } catch {}

  if (!sceneAttached) {
    rafId = requestAnimationFrame(rafLoop)
  }
})

onUnmounted(() => {
  if (sceneCleanup) sceneCleanup()
  if (rafId) cancelAnimationFrame(rafId)
})
onUnmounted(() => {
  if (sceneCleanup) sceneCleanup()
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<style scoped>
.debug-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10001;
  background: rgba(0,0,0,0.7);
  color: #d8f3dc;
  padding: 10px 12px;
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  min-width: 220px;
}
.header { font-weight: 600; margin-bottom: 6px; }
.row { margin: 6px 0; display: flex; align-items: center; gap: 8px; }
.hint { margin-top: 8px; opacity: 0.8; font-size: 12px; }
</style>
