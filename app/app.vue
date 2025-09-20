<template>
  <div>
    <NuxtRouteAnnouncer />
    <h1>Super Critic — Phaser + Nuxt demo</h1>

    <div style="display:flex;gap:16px;align-items:flex-start">
      <div>
        <button @click="startGame">Start Game</button>
        <button @click="stopGame">Stop Game</button>

        <div style="margin-top:12px">
          <strong>Last score:</strong> {{ lastScore }}</div>
      </div>
      <ClientOnly placeholder="Loading game...">
        <div class="game-container">
          <Game />
        </div>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
const lastScore = ref<number | null>(null)

const { on, off, emit } = useEventBus()

function startGame() {
  emit('vue:start')
}

function stopGame() {
  emit('vue:stop')
}

function handleScore(data: any) {
  lastScore.value = data?.score ?? null
}

on('phaser:score', handleScore)

onBeforeUnmount(() => {
  off('phaser:score', handleScore)
})
</script>
