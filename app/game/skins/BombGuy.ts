import Phaser from 'phaser'
import type { PlayerSkin } from './PlayerSkin'

export const BombGuySkin: PlayerSkin = {
  key: 'bomb-guy',
  desiredDisplayHeight: 58, // native ~58
  origin: { x: 0.5, y: 0.5 },
  // Rough body for 58x58 frames
  body: { width: 24, height: 50, offsetX: 17, offsetY: 4 },
  idleCount: 26, // from directory listing
  runCount: 14,
  idleRate: 10,
  runRate: 12,
  jumpCount: 4,
  jumpRate: 10,
  fallCount: 2,
  fallRate: 8,
  landCount: 1,
  landRate: 10,
  hitCount: 8,
  hitRate: 10,
  deadHitCount: 6,
  deadHitRate: 8,
  deadGroundCount: 4,
  deadGroundRate: 8,
  preload(scene: Phaser.Scene) {
    const base = '/assets/sprites/player/player-bomb-guy'
    for (let i = 1; i <= this.idleCount; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_idle_${i}`, `${base}/idle/idle-${ii}.png`)
    }
    for (let i = 1; i <= this.runCount; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_run_${i}`, `${base}/run/run-${ii}.png`)
    }
    for (let i = 1; i <= (this.jumpCount ?? 0); i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_jump_${i}`, `${base}/jump/jump-${ii}.png`)
    }
    for (let i = 1; i <= (this.fallCount ?? 0); i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_fall_${i}`, `${base}/fall/fall-${ii}.png`)
    }
    // jump anticipation as land(ing) fallback if needed
    for (let i = 1; i <= 1; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_land_${i}`, `${base}/jump-anticipation/jump-anticipation-${ii}.png`)
    }
    for (let i = 1; i <= (this.hitCount ?? 0); i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_hit_${i}`, `${base}/hit/hit-${ii}.png`)
    }
    for (let i = 1; i <= (this.deadHitCount ?? 0); i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_dead_hit_${i}`, `${base}/dead-hit/dead-hit-${ii}.png`)
    }
    for (let i = 1; i <= (this.deadGroundCount ?? 0); i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_dead_ground_${i}`, `${base}/dead-ground/dead-ground-${ii}.png`)
    }
  }
}
