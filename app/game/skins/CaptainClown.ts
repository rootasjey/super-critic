import Phaser from 'phaser'
import type { PlayerSkin } from './PlayerSkin'

export const CaptainClownSkin: PlayerSkin = {
  key: 'captain-clown',
  desiredDisplayHeight: 90,
  origin: { x: 0.5, y: 0.5 },
  body: { width: 10, height: 12, offsetX: 9, offsetY: 2 }, // tuned for 64x40 frames
  idleCount: 5,
  runCount: 6,
  idleRate: 8,
  runRate: 10,
  jumpCount: 3,
  jumpRate: 10,
  fallCount: 1,
  fallRate: 8,
  landCount: 2,
  landRate: 10,
  hitCount: 4,
  hitRate: 10,
  deadHitCount: 4,
  deadHitRate: 8,
  deadGroundCount: 4,
  deadGroundRate: 8,
  preload(scene: Phaser.Scene) {
    const base = '/assets/sprites/player/captain-clown-nose/captain-clown-nose-without-sword'
    for (let i = 1; i <= 5; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_idle_${i}`, `${base}/idle/idle-${ii}.png`)
    }
    for (let i = 1; i <= 6; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_run_${i}`, `${base}/run/run-${ii}.png`)
    }
    for (let i = 1; i <= 3; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_jump_${i}`, `${base}/jump/jump-${ii}.png`)
    }
    for (let i = 1; i <= 1; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_fall_${i}`, `${base}/fall/fall-${ii}.png`)
    }
    for (let i = 1; i <= 2; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_land_${i}`, `${base}/ground/ground-${ii}.png`)
    }
    for (let i = 1; i <= 4; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_hit_${i}`, `${base}/hit/hit-${ii}.png`)
    }
    for (let i = 1; i <= 4; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_dead_hit_${i}`, `${base}/dead-hit/dead-hit-${ii}.png`)
    }
    for (let i = 1; i <= 4; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_dead_ground_${i}`, `${base}/dead-ground/dead-ground-${ii}.png`)
    }
  }
}
