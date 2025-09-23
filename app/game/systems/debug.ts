import Phaser from 'phaser'
import { useDebugStore } from '@/stores/debug'
import type { Player } from '~/game/Player'

export type PlayerDebugHandles = {
  gfx: Phaser.GameObjects.Graphics
  platformsGfx: Phaser.GameObjects.Graphics
  text: Phaser.GameObjects.Text
  cleanup: () => void
}

export function setupPlayerDebug(scene: Phaser.Scene, player: Player): PlayerDebugHandles {
  const debugStore = useDebugStore()

  const gfx = scene.add.graphics(); gfx.setDepth(9999)
  const platformsGfx = scene.add.graphics(); platformsGfx.setDepth(9998)
  const text = scene.add.text(8, 8, '', { fontFamily: 'monospace', fontSize: '12px', color: '#00ff88' })
  text.setScrollFactor(0)
  text.setDepth(10000)

  const onF3 = () => {
    debugStore.enabled = !debugStore.enabled
    player.debugEnabled = debugStore.enabled && debugStore.playerCollider
    gfx.clear()
    text.setVisible(debugStore.enabled && debugStore.playerCollider)
  }
  scene.input.keyboard!.on('keydown-F3', onF3)

  const onF1 = () => {
    try {
      const mgr = scene.scene
      const key = scene.scene?.key
      if (mgr && typeof mgr.isPaused === 'function' && key) {
        if (mgr.isPaused(key)) mgr.resume(key)
        else mgr.pause(key)
        return
      }
      // instance pause/resume
      if (typeof scene.scene.pause === 'function') {
        const paused = !!scene.sys?.isPaused
        if (paused && typeof scene.scene.resume === 'function') scene.scene.resume()
        else if (typeof scene.scene.pause === 'function') scene.scene.pause()
        return
      }
    } catch {}
  }
  scene.input.keyboard!.on('keydown-F1', onF1)

  const onF2 = () => {
    try {
      if (typeof scene.scene.restart === 'function') {
        scene.scene.restart()
        return
      }
      const key = scene.scene?.key
      const mgr = scene.scene
      if (mgr && key && typeof mgr.stop === 'function' && typeof mgr.start === 'function') {
        mgr.stop(key)
        mgr.start(key)
      }
    } catch {}
  }
  scene.input.keyboard!.on('keydown-F2', onF2)

  const step = (e: KeyboardEvent) => (e.shiftKey ? 5 : 1)
  const onKey = (e: KeyboardEvent) => {
    if (!player) return
    const b = player.getBodySrc()
    let changed = false
    switch (e.key.toLowerCase()) {
      case 'j': b.width = Math.max(1, b.width - step(e)); changed = true; break
      case 'l': b.width = b.width + step(e); changed = true; break
      case 'i': b.height = b.height + step(e); changed = true; break
      case 'k': b.height = Math.max(1, b.height - step(e)); changed = true; break
      case 'u': b.offsetX = Math.max(0, b.offsetX - step(e)); changed = true; break
      case 'o': b.offsetX = b.offsetX + step(e); changed = true; break
      case 'n': b.offsetY = Math.max(0, b.offsetY - step(e)); changed = true; break
      case 'm': b.offsetY = b.offsetY + step(e); changed = true; break
      case 'p': if (debugStore.enabled) { console.log('[Player Body Src]', player.getBodySrc()) } break
    }
    if (changed) player.setBodySrc(b)
  }
  scene.input.keyboard!.on('keydown', onKey)

  // initial state sync
  player.debugEnabled = debugStore.playerCollider && debugStore.enabled
  gfx.clear()
  text.setVisible(debugStore.enabled && debugStore.playerCollider)

  const cleanup = () => {
  scene.input.keyboard?.off('keydown-F3', onF3)
    scene.input.keyboard?.off('keydown-F1', onF1)
    scene.input.keyboard?.off('keydown-F2', onF2)
    scene.input.keyboard?.off('keydown', onKey)
    gfx.destroy()
    platformsGfx.destroy()
    text.destroy()
  }

  return { gfx, platformsGfx, text, cleanup }
}
