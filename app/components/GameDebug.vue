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
    <div class="section">
      <div class="subheader">Skins</div>
      <div class="row small">
        <label class="control">
          Active skin
          <select :value="selectedSkinId" @change="onSkinChange">
            <option v-for="option in skinOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="isBombSkin" class="group">
        <div class="group-title">Bomb tuning</div>
        <div class="row small wrap">
          <label class="control">Cooldown (ms)
            <input type="number" v-model.number="bombForm.cooldownMs" :placeholder="formatPlaceholder(defaultOverrides?.bomb?.cooldownMs)" class="input" />
          </label>
          <label class="control">Radius min
            <input type="number" v-model.number="bombForm.radiusMin" :placeholder="formatPlaceholder(defaultOverrides?.bomb?.radius?.min)" class="input" />
          </label>
          <label class="control">Radius max
            <input type="number" v-model.number="bombForm.radiusMax" :placeholder="formatPlaceholder(defaultOverrides?.bomb?.radius?.max)" class="input" />
          </label>
        </div>
        <div class="row small wrap">
          <label class="control">Damage min
            <input type="number" v-model.number="bombForm.damageMin" :placeholder="formatPlaceholder(defaultOverrides?.bomb?.damage?.min)" class="input" />
          </label>
          <label class="control">Damage max
            <input type="number" v-model.number="bombForm.damageMax" :placeholder="formatPlaceholder(defaultOverrides?.bomb?.damage?.max)" class="input" />
          </label>
        </div>
      </div>

      <div v-if="isMeleeSkin" class="group">
        <div class="group-title">Melee tuning</div>
        <div class="row small wrap">
          <label class="control">Ground dmg ×
            <input type="number" step="0.05" v-model.number="meleeForm.groundMultiplier" :placeholder="formatPlaceholder(defaultOverrides?.melee?.damage?.groundMultiplier)" class="input" />
          </label>
          <label class="control">Air dmg ×
            <input type="number" step="0.05" v-model.number="meleeForm.airMultiplier" :placeholder="formatPlaceholder(defaultOverrides?.melee?.damage?.airMultiplier)" class="input" />
          </label>
        </div>
        <div class="row small wrap">
          <label class="control">Crit chance
            <input type="number" step="0.05" min="0" max="1" v-model.number="meleeForm.critChance" :placeholder="formatPlaceholder(defaultOverrides?.melee?.crit?.chance)" class="input" />
          </label>
          <label class="control">Crit dmg ×
            <input type="number" step="0.1" min="1" v-model.number="meleeForm.critMultiplier" :placeholder="formatPlaceholder(defaultOverrides?.melee?.crit?.multiplier)" class="input" />
          </label>
          <label class="control">Crit knockback ×
            <input type="number" step="0.05" min="0" v-model.number="meleeForm.critKnockbackMultiplier" :placeholder="formatPlaceholder(defaultOverrides?.melee?.crit?.knockbackMultiplier)" class="input" />
          </label>
        </div>
      </div>

      <div class="row small wrap">
        <button type="button" class="btn" @click="applyOverrides">Apply overrides</button>
        <button type="button" class="btn" style="margin-left:6px" @click="useDefaultOverrides" :disabled="!defaultOverrides">Use defaults</button>
        <button type="button" class="btn" style="margin-left:6px" @click="clearOverrides">Clear</button>
      </div>
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
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDebugStore } from '@/stores/debug'
import { listPlayerSkinOptions, resolvePlayerSkinDefinition } from '~/game/skins'
import type { AttackOverrideConfig } from '~/game/systems/attack'

const debug = useDebugStore()
const { selectedSkinId, skinOverrides } = storeToRefs(debug)

const skinOptions = listPlayerSkinOptions()
const currentSkinDef = computed(() => resolvePlayerSkinDefinition(selectedSkinId.value))
const defaultOverrides = computed(() => currentSkinDef.value.defaultOverrides ?? null)
const isBombSkin = computed(() => currentSkinDef.value.skin.key.includes('bomb'))
const isMeleeSkin = computed(() => !isBombSkin.value)

const bombForm = reactive<{ cooldownMs: number | null; radiusMin: number | null; radiusMax: number | null; damageMin: number | null; damageMax: number | null }>({
  cooldownMs: null,
  radiusMin: null,
  radiusMax: null,
  damageMin: null,
  damageMax: null,
})

const meleeForm = reactive<{ groundMultiplier: number | null; airMultiplier: number | null; critChance: number | null; critMultiplier: number | null; critKnockbackMultiplier: number | null }>({
  groundMultiplier: null,
  airMultiplier: null,
  critChance: null,
  critMultiplier: null,
  critKnockbackMultiplier: null,
})

function clearForms() {
  bombForm.cooldownMs = null
  bombForm.radiusMin = null
  bombForm.radiusMax = null
  bombForm.damageMin = null
  bombForm.damageMax = null
  meleeForm.groundMultiplier = null
  meleeForm.airMultiplier = null
  meleeForm.critChance = null
  meleeForm.critMultiplier = null
  meleeForm.critKnockbackMultiplier = null
}

function loadOverrides() {
  const overrides = debug.getOverridesForSkin(selectedSkinId.value)
  clearForms()
  const bomb = overrides?.bomb
  if (bomb) {
    bombForm.cooldownMs = bomb.cooldownMs ?? null
    bombForm.radiusMin = bomb.radius?.min ?? null
    bombForm.radiusMax = bomb.radius?.max ?? null
    bombForm.damageMin = bomb.damage?.min ?? null
    bombForm.damageMax = bomb.damage?.max ?? null
  }
  const melee = overrides?.melee
  if (melee) {
    meleeForm.groundMultiplier = melee.damage?.groundMultiplier ?? null
    meleeForm.airMultiplier = melee.damage?.airMultiplier ?? null
    meleeForm.critChance = melee.crit?.chance ?? null
    meleeForm.critMultiplier = melee.crit?.multiplier ?? null
    meleeForm.critKnockbackMultiplier = melee.crit?.knockbackMultiplier ?? null
  }
}

watch([selectedSkinId, skinOverrides], loadOverrides, { immediate: true, deep: true })

function onSkinChange(event: Event) {
  const target = event.target as HTMLSelectElement | null
  if (!target) return
  debug.setSelectedSkin(target.value)
}

function buildOverridesFromForms(): AttackOverrideConfig {
  const overrides: AttackOverrideConfig = {}
  if (isBombSkin.value) {
    const bomb: NonNullable<AttackOverrideConfig['bomb']> = {}
    if (bombForm.cooldownMs !== null) bomb.cooldownMs = bombForm.cooldownMs
    const radius: NonNullable<NonNullable<AttackOverrideConfig['bomb']>['radius']> = {}
    if (bombForm.radiusMin !== null) radius.min = bombForm.radiusMin
    if (bombForm.radiusMax !== null) radius.max = bombForm.radiusMax
    if (Object.keys(radius).length > 0) bomb.radius = radius
    const damage: NonNullable<NonNullable<AttackOverrideConfig['bomb']>['damage']> = {}
    if (bombForm.damageMin !== null) damage.min = bombForm.damageMin
    if (bombForm.damageMax !== null) damage.max = bombForm.damageMax
    if (Object.keys(damage).length > 0) bomb.damage = damage
    if (Object.keys(bomb).length > 0) overrides.bomb = bomb
  }
  if (isMeleeSkin.value) {
    const melee: NonNullable<AttackOverrideConfig['melee']> = {}
    const damage: NonNullable<NonNullable<AttackOverrideConfig['melee']>['damage']> = {}
    if (meleeForm.groundMultiplier !== null) damage.groundMultiplier = meleeForm.groundMultiplier
    if (meleeForm.airMultiplier !== null) damage.airMultiplier = meleeForm.airMultiplier
    if (Object.keys(damage).length > 0) melee.damage = damage
    const crit: NonNullable<NonNullable<AttackOverrideConfig['melee']>['crit']> = {}
    if (meleeForm.critChance !== null) crit.chance = meleeForm.critChance
    if (meleeForm.critMultiplier !== null) crit.multiplier = meleeForm.critMultiplier
    if (meleeForm.critKnockbackMultiplier !== null) crit.knockbackMultiplier = meleeForm.critKnockbackMultiplier
    if (Object.keys(crit).length > 0) melee.crit = crit
    if (Object.keys(melee).length > 0) overrides.melee = melee
  }
  return overrides
}

function applyOverrides() {
  const overrides = buildOverridesFromForms()
  if (Object.keys(overrides).length > 0) debug.setSkinOverrides(selectedSkinId.value, overrides)
  else debug.resetSkinOverrides(selectedSkinId.value)
}

function useDefaultOverrides() {
  const defaults = defaultOverrides.value
  if (!defaults) {
    clearForms()
    applyOverrides()
    return
  }
  clearForms()
  if (defaults.bomb) {
    bombForm.cooldownMs = defaults.bomb.cooldownMs ?? null
    bombForm.radiusMin = defaults.bomb.radius?.min ?? null
    bombForm.radiusMax = defaults.bomb.radius?.max ?? null
    bombForm.damageMin = defaults.bomb.damage?.min ?? null
    bombForm.damageMax = defaults.bomb.damage?.max ?? null
  }
  if (defaults.melee) {
    meleeForm.groundMultiplier = defaults.melee.damage?.groundMultiplier ?? null
    meleeForm.airMultiplier = defaults.melee.damage?.airMultiplier ?? null
    meleeForm.critChance = defaults.melee.crit?.chance ?? null
    meleeForm.critMultiplier = defaults.melee.crit?.multiplier ?? null
    meleeForm.critKnockbackMultiplier = defaults.melee.crit?.knockbackMultiplier ?? null
  }
  applyOverrides()
}

function clearOverrides() {
  clearForms()
  debug.resetSkinOverrides(selectedSkinId.value)
}

function formatPlaceholder(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

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
.row.small { font-size: 13px; gap: 6px; }
.row.wrap { flex-wrap: wrap; }
.section { margin: 10px 0; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.12); }
.subheader { font-weight: 600; font-size: 13px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.02em; }
.group { margin: 6px 0; padding-left: 6px; border-left: 2px solid rgba(255,255,255,0.12); }
.group-title { font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #b7f4ff; }
.control { display: flex; flex-direction: column; gap: 4px; font-size: 13px; min-width: 112px; }
.control select,
.control input {
  background: rgba(12, 24, 24, 0.45);
  border: 1px solid rgba(255,255,255,0.18);
  color: inherit;
  border-radius: 4px;
  padding: 3px 6px;
  font-family: inherit;
  font-size: 13px;
}
.control select:focus,
.control input:focus {
  outline: none;
  border-color: rgba(111, 210, 255, 0.6);
  box-shadow: 0 0 0 1px rgba(111, 210, 255, 0.35);
}
.hint { margin-top: 8px; opacity: 0.8; font-size: 12px; }
</style>
