import Phaser from 'phaser'

export interface PlayerSkin {
  key: string
  // Target on-screen height in pixels (world units) for visual parity
  desiredDisplayHeight: number
  // Origin used for the sprite; default center
  origin: { x: number; y: number }
  // Arcade Body config in source-frame pixels (pre-scale)
  body: { width: number; height: number; offsetX: number; offsetY: number }
  // Animation info
  idleCount: number
  runCount: number
  idleRate: number
  runRate: number
  // Optional additional animations
  jumpCount?: number; jumpRate?: number
  fallCount?: number; fallRate?: number
  landCount?: number; landRate?: number
  hitCount?: number; hitRate?: number
  deadHitCount?: number; deadHitRate?: number
  deadGroundCount?: number; deadGroundRate?: number
  // Load images for all used animations with keys like `player_<anim>_<index>`
  preload(scene: Phaser.Scene): void
}
