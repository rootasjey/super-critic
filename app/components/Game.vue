<template>
  <div ref="container" class="game-container"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import Phaser from 'phaser'
import { useEventBus } from '~/composables/useEventBus'

const container = ref<HTMLElement | null>(null)
let game: Phaser.Game | null = null

const { on, off, emit } = useEventBus()

class DemoScene extends Phaser.Scene {
  score = 0
  scoreText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'DemoScene' })
  }

  preload() {
    this.load.image('star', 'https://labs.phaser.io/assets/demoscene/star2.png')
    this.load.image('heart', 'assets/sprites/17-Heart/1-Idle/1.png')
  }

  create() {
    this.add.text(10, 10, 'Phaser in Nuxt demo', { fontSize: '18px', color: '#fff' })
    this.scoreText = this.add.text(10, 40, 'Score: 0', { fontSize: '16px', color: '#fff' })

    const heart = this.add.image(200, 150, 'heart').setInteractive()
    heart.on('pointerdown', () => {
      this.score += 1
      this.scoreText.setText('Score: ' + this.score)
      emit('phaser:score', { score: this.score })
    })
  }
}

function createPhaserGame(parent: HTMLElement) {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 400,
    height: 300,
    backgroundColor: '#2d2d2d',
    parent,
    scene: [DemoScene],
  }
  return new Phaser.Game(config)
}

function onStart() {
  if (!game && container.value) {
    game = createPhaserGame(container.value)
  }
}

function onStop() {
  if (game) {
    game.destroy(true)
    game = null
  }
}

onMounted(() => {
  const { on, off, emit } = useEventBus()
  on('vue:start', onStart)
  on('vue:stop', onStop)
  // auto-start
  if (container.value) onStart()
})

onBeforeUnmount(() => {
  off('vue:start', onStart)
  off('vue:stop', onStop)
  onStop()
})
</script>

<style scoped>
.game-container {
  width: 400px;
  height: 300px;
}
</style>
