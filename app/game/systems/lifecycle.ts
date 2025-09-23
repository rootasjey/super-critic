import Phaser from 'phaser'
import { clearCameraEffects } from './camera'

export function onSceneTeardown(scene: Phaser.Scene, cleanup: () => void) {
  const safeCleanup = () => {
    try { cleanup() } catch {}
  }
  scene.events.once('shutdown', safeCleanup)
  scene.events.once('destroy', safeCleanup)
}

/**
 * Remove common runtime allocations (timers, tweens, camera FX) for a scene.
 */
export function teardownSceneDefaults(scene: Phaser.Scene) {
  try { scene.time.removeAllEvents() } catch {}
  try { scene.tweens.killAll() } catch {}
  try { clearCameraEffects(scene) } catch {}
}

/**
 * Convenience to attach an event listener and auto-remove it on scene teardown.
 */
export function trackEmitterListener<T extends Phaser.Events.EventEmitter>(
  scene: Phaser.Scene,
  emitter: T,
  event: string,
  listener: (...args: any[]) => void,
  context?: any,
) {
  emitter.on(event, listener, context)
  onSceneTeardown(scene, () => {
    try { emitter.off(event, listener, context) } catch {}
  })
}

