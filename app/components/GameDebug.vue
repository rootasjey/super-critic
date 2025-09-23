<template>
  <div v-if="debug.enabled" class="debug-panel">
    <div class="header">Game Debug</div>
    <div class="row">
      <label><input type="checkbox" v-model="debug.playerCollider" /> Player collider</label>
    </div>
    <div class="row">
      <label><input type="checkbox" v-model="debug.platformsCollider" /> Platforms colliders</label>
    </div>
    <div class="hint">F2 toggles in-canvas overlay. Use J/L, I/K, U/O, N/M to adjust player collider. P prints values.</div>
  </div>
  
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useDebugStore } from '@/stores/debug'

const debug = useDebugStore()

onMounted(() => {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('debug') === 'true') debug.enabled = true
  } catch {}
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
