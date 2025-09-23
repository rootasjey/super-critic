import Phaser from 'phaser'
import type { PlayerSkin } from './PlayerSkin'

export const CaptainClownSwordSkin: PlayerSkin = {
  key: 'captain-clown-sword',
  desiredDisplayHeight: 90,
  origin: { x: 0.5, y: 0.5 },
  body: { width: 10, height: 12, offsetX: 9, offsetY: 2 },
  idleCount: 8,
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
    const base = '/assets/sprites/player/captain-clown-nose/captain-clown-nose-with-sword'
    // Use sword-specific idle/run/jump/fall/ground/hit
    for (let i = 1; i <= 8; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_idle_${i}`, `${base}/idle-sword/idle-sword-${ii}.png`)
    }
    for (let i = 1; i <= 6; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_run_${i}`, `${base}/run-sword/run-sword-${ii}.png`)
    }
    for (let i = 1; i <= 3; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_jump_${i}`, `${base}/jump-sword/jump-sword-${ii}.png`)
    }
    for (let i = 1; i <= 1; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_fall_${i}`, `${base}/fall-sword/fall-sword-${ii}.png`)
    }
    for (let i = 1; i <= 2; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_land_${i}`, `${base}/ground-sword/ground-sword-${ii}.png`)
    }
    for (let i = 1; i <= 4; i++) {
      const ii = String(i).padStart(2, '0')
      scene.load.image(`player_hit_${i}`, `${base}/hit-sword/hit-sword-${ii}.png`)
    }
    // Sword-specific extras are available under sword-effects/* and sword/*
  }
}
