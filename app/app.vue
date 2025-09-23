<template>
  <div>
    <NuxtRouteAnnouncer />
    <div style="display:flex;gap:16px;align-items:flex-start">
      <ClientOnly placeholder="Loading game...">
        <div style="flex:1;display:flex;align-items:flex-start;justify-content:center">
          <Game />
        </div>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import "~/styles/main.css"
import '@una-ui/preset/una.css'

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
